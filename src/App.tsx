import { useState, useMemo, useEffect, useCallback } from 'react';
import { Battery, Zap, HelpCircle, ChevronDown } from 'lucide-react';
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
  const [helpOpen, setHelpOpen] = useState(false);
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
    // When tomorrow has no data, mirror today's slots as estimate
    const tomorrowSlots = yasno.groupData.tomorrow.slots.length > 0
      ? yasno.groupData.tomorrow.slots
      : yasno.groupData.today.slots;
    return buildScheduleFromYasno(
      yasno.groupData.today.slots,
      tomorrowSlots,
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

  // ── Route: /status — simplified resident view ──
  if (route === '#/status') {
    return (
      <ResidentStatusPage
        timelineData={calculationResult.timelineData}
        battery={effectiveBatterySettings}
        appliances={appliances}
        powerSchedule={effectivePowerSchedule}
        todayFullPeriods={todayFullPeriods}
        currentTime={currentTime}
        tomorrowHasData={tomorrowHasData}
        deyeTimestamp={deye.deyeTimestamp}
        batteryPower={deye.batteryPower}
      />
    );
  }

  // ── Route: / — full calculator ──
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

        {/* Collapsible instructions */}
        <div className="mb-5 md:mb-8">
          <button
            onClick={() => setHelpOpen(!helpOpen)}
            className="w-full flex items-center gap-2 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-sm font-medium text-slate-500 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Як користуватися
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${helpOpen ? 'rotate-180' : ''}`} />
          </button>
          {helpOpen && (
            <div className="mt-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 text-sm text-slate-600 space-y-3">
              <p className="font-semibold text-slate-700">Режим роботи (верхня панель)</p>
              <ul className="list-disc ml-5 space-y-1">
                <li><b>Авто (ДТЕК + Deye)</b> — графік відключень і заряд батареї підтягуються автоматично. Нічого заповнювати не потрібно.</li>
                <li><b>Ручний</b> — введіть параметри батареї та розклад електрики самостійно (див. нижче).</li>
              </ul>
              <p className="font-semibold text-slate-700 pt-1">Розділи</p>
              <ul className="list-none ml-1 space-y-1.5">
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1.5">1</span><b>Статус</b> — поточний стан: заряд, автономність, потужність.</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1.5">2</span><b>Параметри батареї</b> — ємність, поточний заряд, ліміти, потужність зарядки. <span className="text-amber-600">⟵ заповніть у ручному режимі</span></li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1.5">3</span><b>Прилади</b> — увімкніть потрібні, вкажіть потужність кожного.</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1.5">4</span><b>Розклад</b> — таймлайн: коли працюють прилади і коли є електрика. <span className="text-amber-600">⟵ перетягніть блоки в ручному режимі</span></li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-100 text-purple-700 text-xs font-bold mr-1.5">AI</span><b>Сценарії</b> — розумні підказки, які розклади обрати. Натисніть «Застосувати» щоб автоматично налаштувати прилади.</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1.5">5</span><b>Графік</b> — прогноз заряду на 24 год. Штрихові лінії кольору бурштину — оцінка (дані на завтра ще не опубліковані).</li>
                <li><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1.5">6</span><b>Довідка</b> — формули розрахунків.</li>
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
          tomorrowHasData={tomorrowHasData}
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
