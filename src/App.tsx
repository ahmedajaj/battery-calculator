import { useState, useMemo, useEffect, useCallback } from 'react';
import { Battery, Zap } from 'lucide-react';
import {
  BatterySettingsPanel,
  ApplianceControls,
  TimelineScheduler,
  BatteryChart,
  StatusDashboard,
  FormulaSection,
  DataModePanel,
  ScenarioPanel,
} from './components';
import type { BatterySettings, Appliance, PowerSchedule, ApiLockedFields, TimeRange, YasnoSlot } from './types';
import { calculateBatteryStatus } from './utils/calculations';
import { useYasnoData } from './hooks/useYasnoData';
import { useDeyeData } from './hooks/useDeyeData';

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
  const [powerSchedule, setPowerSchedule] = useState<PowerSchedule>(defaultPowerSchedule);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Yasno data source
  const yasno = useYasnoData(60_000);

  // Deye battery data source
  const deye = useDeyeData(60_000);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

  // ── Merge Yasno data over manual state ──
  const isYasno = yasno.mode === 'yasno' && yasno.groupData !== null;

  // ── Merge Deye SOC over manual battery charge ──
  const isDeyeLive = deye.mode === 'deye' && deye.soc !== null;

  const effectiveBatterySettings = useMemo<BatterySettings>(() => {
    if (!isDeyeLive || deye.soc === null) return batterySettings;
    return { ...batterySettings, currentCharge: deye.soc };
  }, [batterySettings, isDeyeLive, deye.soc]);

  const effectivePowerSchedule = useMemo<PowerSchedule>(() => {
    if (!isYasno || !yasno.groupData) return powerSchedule;
    return buildScheduleFromYasno(
      yasno.groupData.today.slots,
      yasno.groupData.tomorrow.slots,
      Math.floor(currentHour),
    );
  }, [powerSchedule, isYasno, yasno.groupData, currentHour]);

  const lockedFields = useMemo<ApiLockedFields>(() => ({
    currentCharge: isDeyeLive,
    powerSchedule: isYasno,
  }), [isDeyeLive, isYasno]);

  // Check if tomorrow's Yasno data is available (non-empty slots)
  const tomorrowHasData = useMemo(() => {
    if (yasno.mode !== 'yasno') return true; // manual mode — user controls everything
    if (!yasno.groupData) return true; // no data yet — don't show uncertain until connected
    return yasno.groupData.tomorrow.slots.length > 0;
  }, [yasno.mode, yasno.groupData]);

  // Calculate all results reactively
  const calculationResult = useMemo(() => {
    return calculateBatteryStatus(effectiveBatterySettings, appliances, effectivePowerSchedule, currentHour);
  }, [effectiveBatterySettings, appliances, effectivePowerSchedule, currentHour]);

  // Appliance-change handlers (clear active scenario on manual edits)
  const handleAppliancesChange = useCallback((newAppliances: Appliance[]) => {
    setAppliances(newAppliances);
    setActiveScenarioId(null);
  }, []);

  const handleApplyScenario = useCallback((scenarioId: string, newAppliances: Appliance[]) => {
    setAppliances(newAppliances);
    setActiveScenarioId(scenarioId);
  }, []);

  return (
    <div className="min-h-screen w-full px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
      <div className="w-full max-w-6xl" style={{ margin: '0 auto' }}>
        {/* Header */}
        <header className="mb-5 md:mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Battery className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                Калькулятор батареї
                <Zap className="w-6 h-6 text-amber-500" />
              </h1>
              <p className="text-slate-500 text-sm md:text-base">
                Планування енергоспоживання при відключеннях електрики
              </p>
            </div>
          </div>
        </header>

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
        />
        
        {/* Section 1: Текущий статус */}
        <section>
          <div className="section-title">
            <span className="section-number">1</span>
            Поточний статус системи
          </div>
          <StatusDashboard result={calculationResult} battery={effectiveBatterySettings} currentTime={currentTime} />
        </section>

        {/* Section 2: Настройки */}
        <section>
          <div className="section-title">
            <span className="section-number">2</span>
            Параметри батареї
          </div>
          <BatterySettingsPanel settings={effectiveBatterySettings} onChange={setBatterySettings} lockedFields={lockedFields} />
        </section>

        {/* Section 3: Приборы */}
        <section>
          <div className="section-title">
            <span className="section-number">3</span>
            Керування приладами
          </div>
          <ApplianceControls appliances={appliances} onChange={handleAppliancesChange} />
        </section>

        {/* Section 4: Расписание */}
        <section>
          <div className="section-title">
            <span className="section-number">4</span>
            Розклад роботи приладів
          </div>
          <TimelineScheduler appliances={appliances} onChange={handleAppliancesChange} powerSchedule={effectivePowerSchedule} onPowerScheduleChange={setPowerSchedule} currentHour={currentHour} powerScheduleLocked={lockedFields.powerSchedule} tomorrowHasData={tomorrowHasData} />
        </section>

        {/* AI Scenario suggestions (near section 4) */}
        <ScenarioPanel
          battery={effectiveBatterySettings}
          appliances={appliances}
          powerSchedule={effectivePowerSchedule}
          currentHour={currentHour}
          onApply={handleApplyScenario}
          activeScenarioId={activeScenarioId}
        />

        {/* Section 5: Прогноз */}
        <section>
          <div className="section-title">
            <span className="section-number">5</span>
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
            <span className="section-number">6</span>
            Довідка
          </div>
          <FormulaSection result={calculationResult} battery={effectiveBatterySettings} />
        </section>

        {/* Footer */}
        <footer className="text-center py-6 text-slate-400 text-sm border-t border-slate-200 mt-8">
          <p>
            Калькулятор батареї v1.0 • Усі розрахунки приблизні
          </p>
        </footer>
      </main>
      </div>
    </div>
  );
}

export default App;
