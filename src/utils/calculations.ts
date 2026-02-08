import type { BatterySettings, Appliance, PowerSchedule, CalculationResult, TimelinePoint, TimeRange } from '../types';

export function calculateBatteryStatus(
  battery: BatterySettings,
  appliances: Appliance[],
  powerSchedule: PowerSchedule,
  currentHour: number = new Date().getHours()
): CalculationResult {
  // Usable energy calculation
  const usablePercentage = battery.maxCharge - battery.minDischarge;
  const usableEnergy = (battery.capacity * usablePercentage) / 100;
  const currentAvailableEnergy = (battery.capacity * Math.max(0, battery.currentCharge - battery.minDischarge)) / 100;

  // Check if power is currently on (appliances run from grid, not battery)
  const isPowerOnNow = isPowerAvailable(Math.floor(currentHour), powerSchedule.periods);

  // Current battery consumption: 0 when grid is on (appliances run from grid)
  const enabledAppliances = appliances.filter(a => a.enabled);
  const activeNow = enabledAppliances.filter(a => isApplianceActive(a, currentHour));
  const applianceConsumption = activeNow.reduce((sum, a) => sum + a.power, 0);
  const currentConsumption = isPowerOnNow ? 0 : applianceConsumption;

  // Hours remaining at current consumption rate (only relevant when power is off)
  const hoursRemaining = currentConsumption > 0 
    ? Math.max(0, currentAvailableEnergy / currentConsumption) 
    : Infinity;

  // Time to full charge (ideal, without accounting for consumption)
  const energyToFull = (battery.capacity * (battery.maxCharge - battery.currentCharge)) / 100;
  const chargeTime = battery.chargingPower > 0 ? energyToFull / battery.chargingPower : Infinity;

  // Generate 24-hour timeline
  const timelineData = generateTimeline(
    battery,
    appliances,
    powerSchedule.periods,
    currentHour
  );

  // Check if can survive until power on
  const canSurviveOutage = checkSurvival(timelineData, battery.minDischarge);

  // Generate recommendations
  const recommendations = generateRecommendations(
    battery,
    appliances,
    hoursRemaining,
    canSurviveOutage,
    powerSchedule.periods,
    currentHour
  );

  return {
    usableEnergy,
    currentAvailableEnergy,
    currentConsumption,
    hoursRemaining: isFinite(hoursRemaining) ? hoursRemaining : 999,
    chargeTime: isFinite(chargeTime) ? chargeTime : 999,
    timelineData,
    canSurviveOutage,
    recommendations,
  };
}

function generateTimeline(
  battery: BatterySettings,
  appliances: Appliance[],
  powerPeriods: TimeRange[],
  currentHour: number
): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  let batteryLevel = battery.currentCharge;
  const startHour = Math.floor(currentHour);

  for (let i = 0; i < 24; i++) {
    const hour = (startHour + i) % 24;
    const isPowerOn = isPowerAvailable(hour, powerPeriods);

    // Get active appliances at this hour
    const activeAppliances = appliances.filter(a =>
      a.enabled && isApplianceActive(a, hour)
    );

    const applianceConsumption = activeAppliances.reduce((sum, a) => sum + a.power, 0);

    // When grid power is on, appliances run from grid — battery consumption = 0
    const batteryConsumption = isPowerOn ? 0 : applianceConsumption;

    if (isPowerOn) {
      // Charging — full charger power, no consumption from battery
      const chargeRate = (battery.chargingPower / battery.capacity) * 100;
      batteryLevel = Math.min(battery.maxCharge, batteryLevel + chargeRate);
    } else {
      // Discharging
      const dischargeRate = (batteryConsumption / battery.capacity) * 100;
      batteryLevel = Math.max(battery.minDischarge, batteryLevel - dischargeRate);
    }

    points.push({
      time: hour,
      batteryLevel: Math.round(batteryLevel * 10) / 10,
      consumption: batteryConsumption,
      charging: isPowerOn,
      appliances: activeAppliances.map(a => a.nameUa),
    });
  }

  return points;
}

function isPowerAvailable(hour: number, periods: TimeRange[]): boolean {
  if (periods.length === 0) return false;
  return periods.some(period => {
    if (period.start <= period.end) {
      return hour >= period.start && hour < period.end;
    } else {
      return hour >= period.start || hour < period.end;
    }
  });
}

function isApplianceActive(appliance: Appliance, hour: number): boolean {
  if (appliance.schedule.length === 0) {
    return true; // Always active if no schedule
  }
  
  return appliance.schedule.some(range => {
    if (range.start <= range.end) {
      return hour >= range.start && hour < range.end;
    } else {
      // Overnight range
      return hour >= range.start || hour < range.end;
    }
  });
}

function checkSurvival(timeline: TimelinePoint[], minDischarge: number): boolean {
  return timeline.every(point => point.batteryLevel > minDischarge);
}

function generateRecommendations(
  battery: BatterySettings,
  appliances: Appliance[],
  hoursRemaining: number,
  canSurvive: boolean,
  powerPeriods: TimeRange[],
  currentHour: number
): string[] {
  const recommendations: string[] = [];

  if (!canSurvive) {
    recommendations.push('⚠️ При поточному споживанні батарея розрядиться до увімкнення світла');
  }

  if (battery.currentCharge < 50) {
    recommendations.push('🔋 Низький заряд батареї. Рекомендується знизити споживання');
  }

  if (hoursRemaining < 4 && hoursRemaining < Infinity) {
    recommendations.push('⏰ Залишилось менше 4 годин роботи. Вимкніть некритичні прилади');
  }

  const enabledAppliances = appliances.filter(a => a.enabled);
  const highPowerAppliances = enabledAppliances.filter(a => a.power > 1);
  
  if (highPowerAppliances.length > 0 && battery.currentCharge < 40) {
    const names = highPowerAppliances.map(a => a.nameUa).join(', ');
    recommendations.push(`💡 Розгляньте вимкнення: ${names}`);
  }

  // Calculate hours until next power on
  let hoursUntilPowerOn = Infinity;
  if (isPowerAvailable(currentHour, powerPeriods)) {
    hoursUntilPowerOn = 0;
  } else {
    for (const period of powerPeriods) {
      let hours = period.start - currentHour;
      if (hours <= 0) hours += 24;
      if (hours < hoursUntilPowerOn) hoursUntilPowerOn = hours;
    }
  }

  if (hoursRemaining < hoursUntilPowerOn && enabledAppliances.length > 1) {
    recommendations.push('🔌 Батареї не вистачить до увімкнення світла. Потрібно вимкнути частину приладів');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Система працює в оптимальному режимі');
  }

  return recommendations;
}

export function formatHours(hours: number): string {
  if (!isFinite(hours) || hours > 100) return '∞';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} хв`;
  if (m === 0) return `${h} год`;
  return `${h} год ${m} хв`;
}

export function getChargeColor(percentage: number): string {
  if (percentage >= 70) return '#22c55e'; // green
  if (percentage >= 40) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}
