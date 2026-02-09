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

// ── Data mode types ──

export type DataMode = 'manual' | 'yasno';
export type BatteryMode = 'deye' | 'manual';

// Yasno API types
export interface YasnoSlot {
  start: number;  // minutes from midnight (0-1440)
  end: number;    // minutes from midnight (0-1440)
  type: 'Definite' | 'NotPlanned';
}

export interface YasnoDayData {
  slots: YasnoSlot[];
  date: string;
  status: string;
}

export interface YasnoGroupData {
  today: YasnoDayData;
  tomorrow: YasnoDayData;
  updatedOn: string;
}

export type YasnoApiResponse = Record<string, YasnoGroupData>;

/** Which fields are currently controlled by Yasno data (read-only in the UI) */
export interface ApiLockedFields {
  currentCharge: boolean;
  powerSchedule: boolean;
}

// ── Calculation result types ──

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
