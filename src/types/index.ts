export interface BatterySettings {
  capacity: number; // kWh
  minDischarge: number; // %
  maxCharge: number; // %
  currentCharge: number; // %
  chargingPower: number; // kW
}

export interface Appliance {
  id: string;
  name: string;
  nameUa: string;
  icon: string;
  power: number; // kW
  enabled: boolean;
  color: string;
  schedule: TimeRange[];
}

export interface TimeRange {
  start: number; // hours (0-24)
  end: number; // hours (0-24)
}

export interface PowerSchedule {
  periods: TimeRange[]; // Each period represents a power-on window (start/end in hours 0-24)
}

export interface CalculationResult {
  usableEnergy: number; // kWh — total range between min and max
  currentAvailableEnergy: number; // kWh — energy above min at current charge
  currentConsumption: number; // kW — consumption at current hour
  hoursRemaining: number;
  chargeTime: number; // hours to full charge
  timelineData: TimelinePoint[];
  canSurviveOutage: boolean;
  recommendations: string[];
}

export interface TimelinePoint {
  time: number; // hour
  batteryLevel: number; // %
  consumption: number; // kW
  charging: boolean;
  appliances: string[];
}
