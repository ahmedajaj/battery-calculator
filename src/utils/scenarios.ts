import type { BatterySettings, Appliance, PowerSchedule, TimeRange } from '../types';
import { calculateBatteryStatus } from './calculations';

// ─── Exported types ───

export interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  tag: 'comfort' | 'balanced' | 'economy' | 'emergency';
  appliances: Appliance[];
  feasible: boolean;
  minBatteryLevel: number;
  minBatteryTime: number; // hour (0-23) when battery hits minimum
  energyUsedKwh: number;
}

export interface SituationSummary {
  batteryPercent: number;
  availableEnergyKwh: number;
  totalOutageHours: number;
  isPowerOnNow: boolean;
  hoursToNextPowerOn: number;
  hoursToNextOutage: number;
}

// ─── Internal helpers ───

function isPowerOn(hour: number, periods: TimeRange[]): boolean {
  if (periods.length === 0) return false;
  return periods.some(p => {
    if (p.start <= p.end) return hour >= p.start && hour < p.end;
    return hour >= p.start || hour < p.end;
  });
}

/** Clone base appliances and override enabled / schedule for specific IDs */
function applyOverrides(
  base: Appliance[],
  overrides: Record<string, { enabled?: boolean; schedule?: TimeRange[] }>,
): Appliance[] {
  return base.map(a => {
    const o = overrides[a.id];
    if (!o) return { ...a };
    return {
      ...a,
      enabled: o.enabled ?? a.enabled,
      schedule: o.schedule !== undefined ? [...o.schedule] : [...a.schedule],
    };
  });
}

/** Run the full 24-h simulation and extract key metrics */
function simulate(
  battery: BatterySettings,
  appliances: Appliance[],
  powerSchedule: PowerSchedule,
  currentHour: number,
): { feasible: boolean; minLevel: number; minTime: number; energyUsed: number } {
  const result = calculateBatteryStatus(battery, appliances, powerSchedule, currentHour);
  let minLevel = Infinity;
  let minTime = 0;
  for (const p of result.timelineData) {
    if (p.batteryLevel < minLevel) {
      minLevel = p.batteryLevel;
      minTime = p.time;
    }
  }
  // Each timeline point covers 1 hour; consumption is kW, so sum = kWh
  const energyUsed = result.timelineData
    .filter(p => !p.charging)
    .reduce((sum, p) => sum + p.consumption, 0);
  return {
    feasible: result.canSurviveOutage,
    minLevel: Math.round(minLevel * 10) / 10,
    minTime,
    energyUsed: Math.round(energyUsed * 10) / 10,
  };
}

// ─── Public API ───

export function analyzeSituation(
  battery: BatterySettings,
  powerSchedule: PowerSchedule,
  currentHour: number,
): SituationSummary {
  const startHour = Math.floor(currentHour);
  const availableEnergyKwh =
    (battery.capacity * Math.max(0, battery.currentCharge - battery.minDischarge)) / 100;

  let totalOutageHours = 0;
  for (let i = 0; i < 24; i++) {
    if (!isPowerOn((startHour + i) % 24, powerSchedule.periods)) totalOutageHours++;
  }

  const isPowerOnNow = isPowerOn(startHour, powerSchedule.periods);

  let hoursToNextPowerOn = 0;
  if (!isPowerOnNow) {
    for (let i = 1; i <= 24; i++) {
      if (isPowerOn((startHour + i) % 24, powerSchedule.periods)) {
        hoursToNextPowerOn = i;
        break;
      }
    }
    if (hoursToNextPowerOn === 0) hoursToNextPowerOn = 24;
  }

  let hoursToNextOutage = 0;
  if (isPowerOnNow) {
    for (let i = 1; i <= 24; i++) {
      if (!isPowerOn((startHour + i) % 24, powerSchedule.periods)) {
        hoursToNextOutage = i;
        break;
      }
    }
  }

  return {
    batteryPercent: battery.currentCharge,
    availableEnergyKwh: Math.round(availableEnergyKwh * 10) / 10,
    totalOutageHours,
    isPowerOnNow,
    hoursToNextPowerOn,
    hoursToNextOutage,
  };
}

/**
 * Generates smart battery-usage scenarios based on the current situation.
 *
 * Priority layers (per user requirements):
 *   1. Heating — always on
 *   2. Water   — always, but can be off for a few hours at night / work-day
 *   3. Elevator — morning + evening rush, extendable when energy allows
 *   4. Lighting — evening / night, lowest priority
 *
 * The function analyses:
 *   • current charge & available energy
 *   • total outage hours in the next 24 h
 *   • time-of-day (night / morning / day / evening)
 *   • hours until next power-on / next outage
 *
 * Each candidate is simulated with `calculateBatteryStatus` to determine
 * feasibility and energy metrics.  Only contextually-relevant scenarios
 * are included; infeasible ones are kept but visually de-emphasised.
 */
export function generateScenarios(
  battery: BatterySettings,
  baseAppliances: Appliance[],
  powerSchedule: PowerSchedule,
  currentHour: number,
): Scenario[] {
  const scenarios: Scenario[] = [];
  const startHour = Math.floor(currentHour);
  const situation = analyzeSituation(battery, powerSchedule, currentHour);

  // ── Time-of-day flags ──
  const isNight = startHour >= 23 || startHour < 6;
  const isMorning = startHour >= 6 && startHour < 10;
  const isDay = startHour >= 10 && startHour < 17;
  const isEvening = startHour >= 17 && startHour < 23;

  // ── Battery level flags ──
  const batteryHigh = battery.currentCharge >= 70;
  const batteryMedium = battery.currentCharge >= 40 && battery.currentCharge < 70;
  const batteryLow = battery.currentCharge < 40;
  const batteryCritical = battery.currentCharge < 20;

  const { totalOutageHours } = situation;

  // ── Helper: build & simulate a candidate ──
  const add = (
    id: string,
    icon: string,
    name: string,
    tag: Scenario['tag'],
    description: string,
    overrides: Record<string, { enabled?: boolean; schedule?: TimeRange[] }>,
  ) => {
    const appliances = applyOverrides(baseAppliances, overrides);
    const sim = simulate(battery, appliances, powerSchedule, currentHour);
    scenarios.push({
      id,
      name,
      description,
      icon,
      tag,
      appliances,
      feasible: sim.feasible,
      minBatteryLevel: sim.minLevel,
      minBatteryTime: sim.minTime,
      energyUsedKwh: sim.energyUsed,
    });
  };

  // ═══════════════════════════════════════════════════════════════
  //  EMERGENCY TIER  (heating only)
  // ═══════════════════════════════════════════════════════════════

  if (batteryCritical && totalOutageHours > 0) {
    add(
      'critical', '🚨', 'Критичний режим', 'emergency',
      `Заряд лише ${battery.currentCharge.toFixed(0)}%! Тільки опалення для збереження тепла.`,
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: false },
        elevator: { enabled: false },
        lighting: { enabled: false },
      },
    );
  } else {
    add(
      'heating-only', '🔥', 'Тільки опалення', 'emergency',
      'Мінімальне споживання — лише опалення працює цілодобово.',
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: false },
        elevator: { enabled: false },
        lighting: { enabled: false },
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  ECONOMY TIER  (heating + limited water / elevator)
  // ═══════════════════════════════════════════════════════════════

  add(
    'basic-needs', '💧', 'Опалення + вода', 'economy',
    'Базові потреби: опалення та водопостачання працюють постійно.',
    {
      heating: { enabled: true, schedule: [] },
      water: { enabled: true, schedule: [] },
      elevator: { enabled: false },
      lighting: { enabled: false },
    },
  );

  // Night economy — water off 23-06
  if (totalOutageHours > 6) {
    add(
      'water-night-off', '🌙', 'Нічна економія', 'economy',
      'Вода вимкнена 23:00–6:00. Ліфт у години пік. Економить батарею вночі.',
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [{ start: 6, end: 23 }] },
        elevator: { enabled: true, schedule: [{ start: 7, end: 9 }, { start: 18, end: 20 }] },
        lighting: { enabled: false },
      },
    );
  }

  // Work-day saver — water off 9-17
  if (isDay || isMorning) {
    add(
      'workday', '💼', 'Робочий день', 'economy',
      'Вода вимкнена 9–17 (всі на роботі). Ліфт вранці та ввечері.',
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [{ start: 0, end: 9 }, { start: 17, end: 24 }] },
        elevator: { enabled: true, schedule: [{ start: 7, end: 9 }, { start: 17, end: 20 }] },
        lighting: { enabled: false },
      },
    );
  }

  // Long outage economy — water only morning+evening
  if (totalOutageHours >= 12) {
    add(
      'long-outage', '🔋', 'Довгий блекаут', 'economy',
      `${totalOutageHours} год без світла. Вода лише вранці та ввечері. Суворий режим.`,
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [{ start: 6, end: 9 }, { start: 17, end: 22 }] },
        elevator: { enabled: true, schedule: [{ start: 7, end: 9 }, { start: 18, end: 20 }] },
        lighting: { enabled: false },
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  BALANCED TIER  (heating + water + elevator variations)
  // ═══════════════════════════════════════════════════════════════

  add(
    'balanced', '⚖️', 'Збалансований', 'balanced',
    'Опалення та вода 24/7. Ліфт у годину пік (7–9, 18–20). Золота середина.',
    {
      heating: { enabled: true, schedule: [] },
      water: { enabled: true, schedule: [] },
      elevator: { enabled: true, schedule: [{ start: 7, end: 9 }, { start: 18, end: 20 }] },
      lighting: { enabled: false },
    },
  );

  // Extended elevator hours when battery has capacity
  if (batteryHigh || batteryMedium) {
    add(
      'extended-elevator', '🏢', 'Розширений ліфт', 'balanced',
      'Ліфт працює довше: 6–10 та 17–22. Зручно для мешканців.',
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [] },
        elevator: { enabled: true, schedule: [{ start: 6, end: 10 }, { start: 17, end: 22 }] },
        lighting: { enabled: false },
      },
    );
  }

  // Morning rush focus
  if (isMorning || (isNight && startHour >= 4)) {
    add(
      'morning-rush', '🌅', 'Ранковий пік', 'balanced',
      'Ліфт працює вранці 6–10 для виходу на роботу. Освітлення під\'їздів до 7:00.',
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [] },
        elevator: { enabled: true, schedule: [{ start: 6, end: 10 }] },
        lighting: { enabled: true, schedule: [{ start: 0, end: 7 }] },
      },
    );
  }

  // Night lighting
  if (isNight || isEvening) {
    add(
      'night-light', '🌃', 'Нічне освітлення', 'balanced',
      'Освітлення під\'їздів 18–7. Вода 5:00–24:00. Ліфт вимкнений.',
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [{ start: 5, end: 24 }] },
        elevator: { enabled: false },
        lighting: { enabled: true, schedule: [{ start: 18, end: 24 }, { start: 0, end: 7 }] },
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  COMFORT TIER  (everything on, various coverage)
  // ═══════════════════════════════════════════════════════════════

  // Evening comfort — after work
  if (isEvening || isDay) {
    add(
      'evening-comfort', '🌇', 'Вечірній комфорт', 'comfort',
      'Комфорт після роботи: ліфт 17–22, освітлення 18–23.',
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [] },
        elevator: { enabled: true, schedule: [{ start: 7, end: 9 }, { start: 17, end: 22 }] },
        lighting: { enabled: true, schedule: [{ start: 18, end: 23 }] },
      },
    );
  }

  // Maximum comfort — always present as a "ceiling" reference
  add(
    'max-comfort', '✨', 'Максимальний комфорт', 'comfort',
    'Все на максимум: ліфт весь день (6–22), освітлення вечір та ніч.',
    {
      heating: { enabled: true, schedule: [] },
      water: { enabled: true, schedule: [] },
      elevator: { enabled: true, schedule: [{ start: 6, end: 22 }] },
      lighting: { enabled: true, schedule: [{ start: 17, end: 24 }, { start: 0, end: 7 }] },
    },
  );

  // Full power — battery is high & outage is manageable
  if (batteryHigh && totalOutageHours > 0 && totalOutageHours <= 8) {
    add(
      'full-power', '⚡', 'Повна потужність', 'comfort',
      `Батарея ${battery.currentCharge.toFixed(0)}%! Усі прилади без обмежень 24/7.`,
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [] },
        elevator: { enabled: true, schedule: [] },
        lighting: { enabled: true, schedule: [] },
      },
    );
  }

  // Short outage — can afford aggressive usage
  if (totalOutageHours > 0 && totalOutageHours <= 3 && !batteryLow) {
    add(
      'short-outage', '⏱️', 'Короткий блекаут', 'comfort',
      `Лише ${totalOutageHours} год без світла — можна дозволити більше споживання.`,
      {
        heating: { enabled: true, schedule: [] },
        water: { enabled: true, schedule: [] },
        elevator: { enabled: true, schedule: [{ start: 6, end: 23 }] },
        lighting: { enabled: true, schedule: [{ start: 17, end: 24 }, { start: 0, end: 7 }] },
      },
    );
  }

  // ─── Sort: feasible first, then comfort → emergency ───
  const tagOrder: Record<string, number> = {
    comfort: 0,
    balanced: 1,
    economy: 2,
    emergency: 3,
  };

  scenarios.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return tagOrder[a.tag] - tagOrder[b.tag];
  });

  return scenarios;
}
