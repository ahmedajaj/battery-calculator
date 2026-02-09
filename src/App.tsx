import { useState, useMemo, useEffect } from 'react';
import { Battery, Zap } from 'lucide-react';
import {
  BatterySettingsPanel,
  ApplianceControls,
  TimelineScheduler,
  BatteryChart,
  StatusDashboard,
  FormulaSection,
} from './components';
import type { BatterySettings, Appliance, PowerSchedule } from './types';
import { calculateBatteryStatus } from './utils/calculations';

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
    power: 4,
    enabled: true,
    color: '#3b82f6',
    schedule: [],
  },
  {
    id: 'heating',
    name: 'Heating Pump',
    nameUa: 'Насос опалення',
    icon: 'flame',
    power: 2,
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
    schedule: [{ start: 7, end: 9 }, { start: 18, end: 20 }],
  },
  {
    id: 'lighting',
    name: 'Lighting',
    nameUa: 'Освітлення',
    icon: 'lightbulb',
    power: 0.4,
    enabled: true,
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
  const [powerSchedule, setPowerSchedule] = useState<PowerSchedule>(defaultPowerSchedule);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

  // Calculate all results reactively
  const calculationResult = useMemo(() => {
    return calculateBatteryStatus(batterySettings, appliances, powerSchedule, currentHour);
  }, [batterySettings, appliances, powerSchedule, currentHour]);

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
        
        {/* Section 1: Текущий статус */}
        <section>
          <div className="section-title">
            <span className="section-number">1</span>
            Поточний статус системи
          </div>
          <StatusDashboard result={calculationResult} battery={batterySettings} currentTime={currentTime} />
        </section>

        {/* Section 2: Настройки */}
        <section>
          <div className="section-title">
            <span className="section-number">2</span>
            Параметри батареї
          </div>
          <BatterySettingsPanel settings={batterySettings} onChange={setBatterySettings} />
        </section>

        {/* Section 3: Приборы */}
        <section>
          <div className="section-title">
            <span className="section-number">3</span>
            Керування приладами
          </div>
          <ApplianceControls appliances={appliances} onChange={setAppliances} />
        </section>

        {/* Section 4: Расписание */}
        <section>
          <div className="section-title">
            <span className="section-number">4</span>
            Розклад роботи приладів
          </div>
          <TimelineScheduler appliances={appliances} onChange={setAppliances} powerSchedule={powerSchedule} onPowerScheduleChange={setPowerSchedule} currentHour={currentHour} />
        </section>

        {/* Section 5: Прогноз */}
        <section>
          <div className="section-title">
            <span className="section-number">5</span>
            Прогноз на 24 години
          </div>
          <BatteryChart
            timelineData={calculationResult.timelineData}
            battery={batterySettings}
            powerSchedule={powerSchedule}
            currentHour={currentHour}
          />
        </section>

        {/* Section 6: Формули */}
        <section>
          <div className="section-title">
            <span className="section-number">6</span>
            Довідка
          </div>
          <FormulaSection result={calculationResult} battery={batterySettings} />
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
