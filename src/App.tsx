import { useState, useMemo, useEffect, useCallback } from 'react';
import { BatteryCharging, HelpCircle, ChevronDown } from 'lucide-react';
import {
  BatterySettingsPanel,
  ApplianceControls,
  TimelineScheduler,
  BatteryChart,
  StatusDashboard,
  FormulaSection,
  DataModePanel,
  ScenarioPanel,
  ResidentStatusPage,
} from './components';
import type { BatterySettings, Appliance, PowerSchedule, ApiLockedFields, TimeRange, YasnoSlot } from './types';
import { calculateBatteryStatus, generateExtendedTimeline } from './utils/calculations';
import { generateScenarios, type Scenario } from './utils/scenarios';
import { useYasnoData } from './hooks/useYasnoData';
import { useDeyeData } from './hooks/useDeyeData';
import { useSharedScenario, type SaveResult } from './hooks/useSharedScenario';

/**
 * Build a merged PowerSchedule from Yasno today+tomorrow slots.
 * Hours >= startHour use today's data, hours < startHour use tomorrow's.
 * Only "NotPlanned" slots become power-on periods.
 */
function buildScheduleFromYasno(
  todaySlots: YasnoSlot[],
  tomorrowSlots: YasnoSlot[],
  startHour: number,
): PowerSchedule {
  const periods: TimeRange[] = [];

  // Today's NotPlanned slots for hours >= startHour
  for (const slot of todaySlots) {
    if (slot.type !== 'NotPlanned') continue;
    const s = slot.start / 60;
    const e = slot.end / 60;
    const cs = Math.max(s, startHour);
    const ce = Math.min(e, 24);
    if (cs < ce) periods.push({ start: cs, end: ce });
  }

  // Tomorrow's NotPlanned slots for hours < startHour
  for (const slot of tomorrowSlots) {
    if (slot.type !== 'NotPlanned') continue;
    const s = slot.start / 60;
    const e = slot.end / 60;
    const cs = Math.max(s, 0);
    const ce = Math.min(e, startHour);
    if (cs < ce) periods.push({ start: cs, end: ce });
  }

  return { periods };
}

/**
 * When tomorrow's ДТЕК schedule is unknown, estimate it based on today's
 * on-period pattern and a user-configurable off-gap (hours between last
 * power-off and next power-on).
 */
function buildEstimatedTomorrowSlots(
  todaySlots: YasnoSlot[],
  offGapHours: number,
): YasnoSlot[] {
  const onPeriods = todaySlots.filter(s => s.type === 'NotPlanned');
  if (onPeriods.length === 0) return todaySlots; // fallback: mirror as-is

  // Average on-period duration (minutes)
  const avgOnMin = Math.round(
    onPeriods.reduce((sum, s) => sum + (s.end - s.start), 0) / onPeriods.length,
  );
  const offGapMin = Math.round(offGapHours * 60);

  // Last power-off today (minutes from midnight)
  const lastOff = Math.max(...onPeriods.map(s => s.end));

  // First predicted on-time for tomorrow (minutes from tomorrow's midnight)
  let nextOn = lastOff + offGapMin - 1440;
  if (nextOn < 0) nextOn = 0;

  // Generate alternating on/off slots covering 0-1440
  const slots: YasnoSlot[] = [];
  let pos = 0;

  while (pos < 1440) {
    if (nextOn > pos) {
      slots.push({ start: pos, end: Math.min(nextOn, 1440), type: 'Definite' });
      pos = Math.min(nextOn, 1440);
    }
    if (pos >= 1440) break;
    const onEnd = Math.min(pos + avgOnMin, 1440);
    slots.push({ start: pos, end: onEnd, type: 'NotPlanned' });
    pos = onEnd;
    nextOn = pos + offGapMin;
  }

  return slots;
}

const defaultBatterySettings: BatterySettings = {
  capacity: 82,
  minDischarge: 10,
  maxCharge: 95,
  currentCharge: 0,
  chargingPower: 20,
};

const defaultAppliances: Appliance[] = [
  {
    id: 'water',
    name: 'Water Pump',
    nameUa: 'Насос води',
    icon: 'droplets',
    power: 2,
    enabled: true,
    color: '#3b82f6',
    schedule: [],
  },
  {
    id: 'heating',
    name: 'Heating Pump',
    nameUa: 'Насос опалення',
    icon: 'flame',
    power: 4,
    enabled: true,
    color: '#ef4444',
    schedule: [],
  },
  {
    id: 'elevator',
    name: 'Elevator',
    nameUa: 'Ліфт',
    icon: 'building',
    power: 3.0,
    enabled: true,
    color: '#a855f7',
    schedule: [{ start: 7, end: 9 }, { start: 18.5, end: 20.5 }],
  },
  {
    id: 'lighting',
    name: 'Lighting',
    nameUa: 'Освітлення',
    icon: 'lightbulb',
    power: 0.4,
    enabled: false,
    color: '#f59e0b',
    schedule: [{ start: 18, end: 24 }, { start: 0, end: 6 }],
  },
];

const defaultPowerSchedule: PowerSchedule = {
  periods: [{ start: 6, end: 14 }],
};

function App() {
  const [batterySettings, setBatterySettings] = useState<BatterySettings>(defaultBatterySettings);
  const [appliances, setAppliances] = useState<Appliance[]>(defaultAppliances);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  // Until the admin edits anything, the calculator mirrors the published scenario
  const [touched, setTouched] = useState(false);
  const [powerSchedule, setPowerSchedule] = useState<PowerSchedule>(defaultPowerSchedule);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [helpOpen, setHelpOpen] = useState(false);
  const [offGapHours, setOffGapHours] = useState(7);
  const [route, setRoute] = useState(() => window.location.hash || '#/');

  // Hash-based routing
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Yasno data source
  const yasno = useYasnoData(60_000);

  // Deye battery data source
  const deye = useDeyeData(60_000);

  // Shared scenario (published to all residents)
  const sharedScenario = useSharedScenario(60_000);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

  // ── Merge Yasno data over manual state ──
  const isYasno = yasno.mode === 'yasno' && yasno.groupData !== null;

  // DTEK can suspend the hourly schedule (status e.g. "EmergencyShutdowns"): slots come back
  // empty. We then forecast the worst case — no grid power at all — and say so in the UI.
  const scheduleSuspended = isYasno && !!yasno.groupData && yasno.groupData.today.status !== 'ScheduleApplies';

  // ── Merge Deye SOC over manual battery charge ──
  const isDeyeLive = deye.mode === 'deye' && deye.soc !== null;

  const effectiveBatterySettings = useMemo<BatterySettings>(() => {
    if (!isDeyeLive || deye.soc === null) return batterySettings;
    return { ...batterySettings, currentCharge: deye.soc };
  }, [batterySettings, isDeyeLive, deye.soc]);

  const effectivePowerSchedule = useMemo<PowerSchedule>(() => {
    if (!isYasno || !yasno.groupData) return powerSchedule;
    if (scheduleSuspended) return { periods: [] };
    // When tomorrow has no data, estimate from today's pattern + off-gap
    const tomorrowSlots = yasno.groupData.tomorrow.slots.length > 0
      ? yasno.groupData.tomorrow.slots
      : buildEstimatedTomorrowSlots(yasno.groupData.today.slots, offGapHours);
    return buildScheduleFromYasno(
      yasno.groupData.today.slots,
      tomorrowSlots,
      Math.floor(currentHour),
    );
  }, [powerSchedule, isYasno, scheduleSuspended, yasno.groupData, currentHour, offGapHours]);

  const lockedFields = useMemo<ApiLockedFields>(() => ({
    currentCharge: isDeyeLive,
    powerSchedule: isYasno,
  }), [isDeyeLive, isYasno]);

  // Check if tomorrow's Yasno data is available (non-empty slots)
  const tomorrowHasData = useMemo(() => {
    if (yasno.mode !== 'yasno') return true; // manual mode — user controls everything
    if (!yasno.groupData) return true; // no data yet — don't show uncertain until connected
    if (scheduleSuspended) return true; // worst case covers tomorrow too (no power)
    return yasno.groupData.tomorrow.slots.length > 0;
  }, [yasno.mode, yasno.groupData, scheduleSuspended]);

  // Appliance-change handlers (clear active scenario on manual edits)
  const handleAppliancesChange = useCallback((newAppliances: Appliance[]) => {
    setAppliances(newAppliances);
    setActiveScenarioId(null);
    setTouched(true);
  }, []);

  const handleApplyScenario = useCallback((scenarioId: string, newAppliances: Appliance[]) => {
    setAppliances(newAppliances);
    setActiveScenarioId(scenarioId);
    setTouched(true);
  }, []);

  // Save scenario to shared storage (for residents) — requires PIN
  const handlePublishScenario = useCallback(async (scenario: Scenario): Promise<SaveResult> => {
    handleApplyScenario(scenario.id, scenario.appliances);
    return sharedScenario.save({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioTag: scenario.tag,
      scenarioDescription: scenario.description,
      updatedAt: new Date().toISOString(),
    });
  }, [handleApplyScenario, sharedScenario]);

  // All scenarios (including situational ones) so the published one is always found
  const allScenarios = useMemo(
    () => generateScenarios(effectiveBatterySettings, appliances, effectivePowerSchedule, currentHour, true),
    [effectiveBatterySettings, appliances, effectivePowerSchedule, currentHour],
  );

  // Full today power-on periods (including already passed) for resident status display
  const todayFullPeriods = useMemo<TimeRange[]>(() => {
    if (!isYasno || !yasno.groupData) return powerSchedule.periods;
    const periods: TimeRange[] = [];
    for (const slot of yasno.groupData.today.slots) {
      if (slot.type !== 'NotPlanned') continue;
      const s = slot.start / 60;
      const e = slot.end / 60;
      if (s < e) periods.push({ start: s, end: e });
    }
    return periods;
  }, [isYasno, yasno.groupData, powerSchedule.periods]);

  // Full tomorrow power-on periods for resident status display
  const tomorrowFullPeriods = useMemo<TimeRange[]>(() => {
    if (!isYasno || !yasno.groupData || yasno.groupData.tomorrow.slots.length === 0) return [];
    const periods: TimeRange[] = [];
    for (const slot of yasno.groupData.tomorrow.slots) {
      if (slot.type !== 'NotPlanned') continue;
      const s = slot.start / 60;
      const e = slot.end / 60;
      if (s < e) periods.push({ start: s, end: e });
    }
    return periods;
  }, [isYasno, yasno.groupData]);

  // ── Route: /status — simplified resident view ──
  // Apply shared scenario's appliances if available
  const statusAppliances = useMemo(() => {
    if (!sharedScenario.shared.scenarioId) return appliances;
    const matched = allScenarios.find(s => s.id === sharedScenario.shared.scenarioId);
    return matched ? matched.appliances : appliances;
  }, [sharedScenario.shared.scenarioId, allScenarios, appliances]);

  // Main calculator: follow the published scenario until the admin changes something
  const publishedMatched = allScenarios.some(sc => sc.id === sharedScenario.shared.scenarioId);
  const mainAppliances = touched ? appliances : statusAppliances;
  const mainActiveScenarioId = touched ? activeScenarioId : (publishedMatched ? sharedScenario.shared.scenarioId : null);

  // Calculate all results reactively
  const calculationResult = useMemo(() => {
    return calculateBatteryStatus(effectiveBatterySettings, mainAppliances, effectivePowerSchedule, currentHour);
  }, [effectiveBatterySettings, mainAppliances, effectivePowerSchedule, currentHour]);

  // Recalculate status timeline with the shared scenario's appliances
  const statusTimelineWithScenario = useMemo(() => {
    if (tomorrowHasData) {
      return generateExtendedTimeline(
        effectiveBatterySettings,
        statusAppliances,
        todayFullPeriods,
        tomorrowFullPeriods,
        currentHour,
      );
    }
    return calculateBatteryStatus(effectiveBatterySettings, statusAppliances, effectivePowerSchedule, currentHour).timelineData;
  }, [tomorrowHasData, effectiveBatterySettings, statusAppliances, todayFullPeriods, tomorrowFullPeriods, currentHour, effectivePowerSchedule]);

  if (route === '#/status') {
    return (
      <ResidentStatusPage
        timelineData={statusTimelineWithScenario}
        battery={effectiveBatterySettings}
        appliances={statusAppliances}
        powerSchedule={effectivePowerSchedule}
        todayFullPeriods={todayFullPeriods}
        tomorrowFullPeriods={tomorrowFullPeriods}
        currentTime={currentTime}
        tomorrowHasData={tomorrowHasData}
        scheduleSuspended={scheduleSuspended}
        deyeTimestamp={deye.deyeTimestamp}
        batteryPower={deye.batteryPower}
        sharedScenarioName={sharedScenario.shared.scenarioName}
        sharedScenarioTag={sharedScenario.shared.scenarioTag}
        sharedScenarioDescription={sharedScenario.shared.scenarioDescription}
        sharedScenarioUpdatedAt={sharedScenario.shared.updatedAt}
      />
    );
  }

  // ── Route: / — full calculator ──
  return (
    <div className="min-h-screen w-full px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
      <div className="w-full max-w-6xl" style={{ margin: '0 auto' }}>
        {/* Header */}
        <header className="mb-6 md:mb-10 animate-fade-up">
          <div className="flex items-center gap-3.5 md:gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-energy-500 blur-xl opacity-40" />
              <div className="relative grid place-items-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-energy-400 via-energy-500 to-cyan-500 shadow-lg ring-1 ring-white/40">
                <BatteryCharging className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={2.25} />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-[2rem] font-bold tracking-tight text-slate-900 leading-tight">
                Калькулятор батареї
              </h1>
              <p className="text-slate-600 text-sm md:text-[0.9375rem] mt-0.5">
                Планування енергоспоживання при відключеннях електрики
              </p>
            </div>
            <a
              href="#/status"
              className="hidden sm:inline-flex ml-auto items-center gap-2 shrink-0 rounded-full bg-slate-900 text-white text-sm font-medium pl-3.5 pr-4 py-2 shadow-md hover:bg-slate-800 transition-colors"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-energy-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-energy-400" />
              </span>
              Сторінка для мешканців
            </a>
          </div>
        </header>

        {/* Collapsible instructions */}
        <div className="mb-5 md:mb-8">
          <button
            onClick={() => setHelpOpen(!helpOpen)}
            className="w-full flex items-center gap-2 py-3 px-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 shadow-sm transition-colors"
            aria-expanded={helpOpen}
          >
            <HelpCircle className="w-4 h-4" />
            Як користуватися
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${helpOpen ? 'rotate-180' : ''}`} />
          </button>
          {helpOpen && (
            <div className="mt-2 card text-sm text-slate-700 space-y-3 animate-fade-up">
              <p className="font-semibold text-slate-900">Режим роботи (верхня панель)</p>
              <ul className="list-disc ml-5 space-y-1">
                <li><b>Авто (ДТЕК + Deye)</b> — графік відключень і заряд батареї підтягуються автоматично. Нічого заповнювати не потрібно.</li>
                <li><b>Ручний</b> — введіть параметри батареї та розклад електрики самостійно (див. нижче).</li>
              </ul>
              <p className="font-semibold text-slate-900 pt-1">Розділи</p>
              <ul className="list-none ml-1 space-y-1.5">
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold mr-1.5">1</span><b>Статус</b> — поточний стан: заряд, автономність, потужність.</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold mr-1.5">2</span><b>Параметри батареї</b> — ємність, поточний заряд, ліміти, потужність зарядки. <span className="text-amber-700">⟵ заповніть у ручному режимі</span></li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold mr-1.5">3</span><b>Прилади</b> — увімкніть потрібні, вкажіть потужність кожного.</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold mr-1.5">4</span><b>Розклад</b> — таймлайн: коли працюють прилади і коли є електрика. <span className="text-amber-700">⟵ перетягніть блоки в ручному режимі</span></li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded bg-violet-100 text-violet-800 text-[11px] font-bold mr-1.5">AI</span><b>Сценарії</b> — розумні підказки, які розклади обрати. Натисніть «Застосувати» щоб автоматично налаштувати прилади.</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold mr-1.5">5</span><b>Графік</b> — прогноз заряду на 24 год. Штрихові лінії кольору бурштину — оцінка (дані на завтра ще не опубліковані).</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold mr-1.5">6</span><b>Довідка</b> — формули розрахунків.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Main content */}
        <main className="space-y-6 md:space-y-10">

        {/* Data mode selector */}
        <DataModePanel
          batteryMode={deye.mode}
          onBatteryModeChange={deye.setMode}
          batterySOC={deye.soc}
          batteryLoading={deye.loading}
          batteryError={deye.error}
          batteryLastUpdated={deye.lastUpdated}
          onBatteryRefetch={deye.refetch}
          batteryTokenConfigured={deye.tokenConfigured}
          scheduleMode={yasno.mode}
          onScheduleModeChange={yasno.setMode}
          group={yasno.group}
          onGroupChange={yasno.setGroup}
          groupData={yasno.groupData}
          availableGroups={yasno.availableGroups}
          scheduleLoading={yasno.loading}
          scheduleError={yasno.error}
          scheduleLastUpdated={yasno.lastUpdated}
          onScheduleRefetch={yasno.refetch}
          scheduleSuspended={scheduleSuspended}
        />
        
        {/* Section 1: Текущий статус */}
        <section>
          <div className="section-title">
            <span className="section-number">01</span>
            Поточний статус системи
          </div>
          <StatusDashboard result={calculationResult} battery={effectiveBatterySettings} currentTime={currentTime} />
        </section>

        {/* Section 2: Настройки */}
        <section>
          <div className="section-title">
            <span className="section-number">02</span>
            Параметри батареї
          </div>
          <BatterySettingsPanel settings={effectiveBatterySettings} onChange={setBatterySettings} lockedFields={lockedFields} />
        </section>

        {/* Section 3: Приборы */}
        <section>
          <div className="section-title">
            <span className="section-number">03</span>
            Керування приладами
          </div>
          <ApplianceControls appliances={mainAppliances} onChange={handleAppliancesChange} />
        </section>

        {/* Section 4: Расписание */}
        <section>
          <div className="section-title">
            <span className="section-number">04</span>
            Розклад роботи приладів
          </div>
          <TimelineScheduler appliances={mainAppliances} onChange={handleAppliancesChange} powerSchedule={effectivePowerSchedule} onPowerScheduleChange={setPowerSchedule} currentHour={currentHour} powerScheduleLocked={lockedFields.powerSchedule} tomorrowHasData={tomorrowHasData} />
        </section>

        {/* AI Scenario suggestions (near section 4) */}
        <ScenarioPanel
          battery={effectiveBatterySettings}
          appliances={appliances}
          powerSchedule={effectivePowerSchedule}
          currentHour={currentHour}
          tomorrowHasData={tomorrowHasData}
          onApply={handleApplyScenario}
          activeScenarioId={mainActiveScenarioId}
          offGapHours={offGapHours}
          onOffGapChange={setOffGapHours}
          onPublish={handlePublishScenario}
          publishedScenarioId={sharedScenario.shared.scenarioId}
          pin={sharedScenario.pin}
          onPinChange={sharedScenario.setPin}
          authError={sharedScenario.authError}
          publishedAt={sharedScenario.shared.updatedAt}
        />

        {/* Section 5: Прогноз */}
        <section>
          <div className="section-title">
            <span className="section-number">05</span>
            Прогноз на 24 години
          </div>
          <BatteryChart
            timelineData={calculationResult.timelineData}
            battery={effectiveBatterySettings}
            powerSchedule={effectivePowerSchedule}
            currentHour={currentHour}
            tomorrowHasData={tomorrowHasData}
          />
        </section>

        {/* Section 6: Формули */}
        <section>
          <div className="section-title">
            <span className="section-number">06</span>
            Довідка
          </div>
          <FormulaSection result={calculationResult} battery={effectiveBatterySettings} />
        </section>

        {/* Footer */}
        <footer className="text-center py-8 text-slate-600 text-xs border-t border-slate-200 mt-8">
          <p>
            Калькулятор батареї · Усі розрахунки приблизні
          </p>
        </footer>
      </main>
      </div>
    </div>
  );
}

export default App;
