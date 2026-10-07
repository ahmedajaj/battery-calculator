import React, { useMemo, useState } from 'react';
import { Sparkles, Check, X, Battery, Clock, Zap, ZapOff, AlertTriangle, Share2, Sofa, Scale, Building2, ThermometerSnowflake, Droplets, Moon, BatteryLow, Flame, TriangleAlert, Lightbulb, type LucideIcon } from 'lucide-react';
import type { BatterySettings, Appliance, PowerSchedule } from '../types';
import { generateScenarios, analyzeSituation, type Scenario } from '../utils/scenarios';

interface Props {
  battery: BatterySettings;
  appliances: Appliance[];
  powerSchedule: PowerSchedule;
  currentHour: number;
  tomorrowHasData: boolean;
  onApply: (scenarioId: string, appliances: Appliance[]) => void;
  activeScenarioId: string | null;
  offGapHours: number;
  onOffGapChange: (hours: number) => void;
  /** Publish the given scenario to shared storage for residents */
  onPublish?: (scenario: Scenario) => Promise<void>;
  /** Currently published scenario id */
  publishedScenarioId?: string | null;
  /** Timestamp of last publish */
  publishedAt?: string | null;
  /** Admin PIN for publishing */
  pin?: string;
  /** PIN change handler */
  onPinChange?: (pin: string) => void;
  /** Whether the last publish attempt failed due to wrong PIN */
  authError?: boolean;
}

const TAG_STYLES: Record<Scenario['tag'], { bg: string; text: string; tile: string; label: string }> = {
  comfort:   { bg: 'bg-emerald-50', text: 'text-emerald-800', tile: 'bg-emerald-100 text-emerald-700', label: 'Комфорт' },
  balanced:  { bg: 'bg-sky-50',     text: 'text-sky-800',     tile: 'bg-sky-100 text-sky-700',         label: 'Баланс' },
  economy:   { bg: 'bg-amber-50',   text: 'text-amber-800',   tile: 'bg-amber-100 text-amber-700',     label: 'Економія' },
  emergency: { bg: 'bg-rose-50',    text: 'text-rose-800',    tile: 'bg-rose-100 text-rose-700',       label: 'Аварійний' },
};

const TAG_ORDER: Scenario['tag'][] = ['comfort', 'balanced', 'economy', 'emergency'];

/** Line icons for each scenario (keys come from utils/scenarios) */
const SCENARIO_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  sofa: Sofa,
  scale: Scale,
  elevator: Building2,
  'thermometer-snowflake': ThermometerSnowflake,
  droplets: Droplets,
  moon: Moon,
  'battery-low': BatteryLow,
  flame: Flame,
  alert: TriangleAlert,
};

const APPLIANCE_ICONS: Record<string, LucideIcon> = {
  heating: Flame,
  water: Droplets,
  elevator: Building2,
  lighting: Lightbulb,
};

const fmtHour = (h: number) => (h % 1 ? `${Math.floor(h)}:30` : `${h}`);

/** Human-readable schedule: "цілодобово", "7–9, 18–20" or "вимкнено" */
const scheduleText = (a: Appliance) => {
  if (!a.enabled) return 'вимкнено';
  if (a.schedule.length === 0) return 'цілодобово';
  return a.schedule.map(r => `${fmtHour(r.start)}–${fmtHour(r.end)}`).join(', ');
};

export const ScenarioPanel: React.FC<Props> = ({
  battery,
  appliances,
  powerSchedule,
  currentHour,
  tomorrowHasData,
  onApply,
  activeScenarioId,
  offGapHours,
  onOffGapChange,
  onPublish,
  publishedScenarioId,
  publishedAt,
  pin = '',
  onPinChange,
  authError = false,
}) => {
  const [publishing, setPublishing] = useState(false);
  const scenarios = useMemo(
    () => generateScenarios(battery, appliances, powerSchedule, currentHour),
    [battery, appliances, powerSchedule, currentHour],
  );

  const situation = useMemo(
    () => analyzeSituation(battery, powerSchedule, currentHour),
    [battery, powerSchedule, currentHour],
  );

  const feasibleCount = scenarios.filter(s => s.feasible).length;

  // Group scenarios by tag
  const grouped = useMemo(() => {
    const map: Partial<Record<Scenario['tag'], Scenario[]>> = {};
    for (const s of scenarios) {
      (map[s.tag] ??= []).push(s);
    }
    return map;
  }, [scenarios]);

  return (
    <div className="card">
      {/* Header */}
      <div className="card-head">
        <div className="card-icon"><Sparkles /></div>
        <div>
          <h2 className="card-title">
            Рекомендовані сценарії
          </h2>
          <p className="card-sub">
            Оберіть сценарій для зміни розкладу • {feasibleCount} з {scenarios.length} можливі
          </p>
        </div>
      </div>

      {/* Situation summary bar */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5 px-3.5 py-3 inset text-[13px]">
        <div className="flex items-center gap-1.5">
          <Battery className="w-4 h-4 text-sky-600" />
          <span className="text-slate-600">
            <span className="font-semibold">{situation.batteryPercent.toFixed(0)}%</span>
            {' '}({situation.availableEnergyKwh} кВт·год)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {situation.isPowerOnNow
            ? <Zap className="w-4 h-4 text-emerald-600" />
            : <ZapOff className="w-4 h-4 text-rose-600" />}
          <span className="text-slate-600">
            {situation.isPowerOnNow ? 'Світло є' : 'Світла немає'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-slate-600">
            {situation.totalOutageHours > 0
              ? `${situation.totalOutageHours} год без світла`
              : 'Відключень не заплановано'}
          </span>
        </div>

        {!situation.isPowerOnNow && situation.hoursToNextPowerOn > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-700" />
            <span className="text-slate-600">
              Увімкнення через{' '}
              <span className="font-semibold">{situation.hoursToNextPowerOn} год</span>
            </span>
          </div>
        )}

        {situation.isPowerOnNow && situation.hoursToNextOutage > 0 && (
          <div className="flex items-center gap-1.5">
            <ZapOff className="w-4 h-4 text-amber-700" />
            <span className="text-slate-600">
              Вимкнення через{' '}
              <span className="font-semibold">{situation.hoursToNextOutage} год</span>
            </span>
          </div>
        )}
      </div>

      {/* Uncertainty banner when tomorrow schedule is unknown */}
      {!tomorrowHasData && (
        <div className="mb-5 alert alert-warn text-[13px] space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
            <span>
              Розклад на завтра ще невідомий — оцінка за паузою між увімкненнями
            </span>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <label className="whitespace-nowrap font-medium">Пауза між увімк.:</label>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={offGapHours}
              onChange={(e) => onOffGapChange(Math.max(1, Math.min(20, parseFloat(e.target.value) || 7)))}
              className="input w-16 h-9 text-center px-1 !border-amber-400"
            />
            <span>год</span>
          </div>
        </div>
      )}

      {/* Scenario cards grouped by tag */}
      {TAG_ORDER.map(tagKey => {
        const group = grouped[tagKey];
        if (!group || group.length === 0) return null;
        const tagMeta = TAG_STYLES[tagKey];

        return (
          <div key={tagKey} className="mb-4 last:mb-0">
            {/* Group header */}
            <div className={`flex items-center gap-2 mb-2.5 px-1`}>
              <span className={`text-xs font-semibold uppercase tracking-wider ${tagMeta.text}`}>
                {tagMeta.label}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map(scenario => {
                const isActive = activeScenarioId === scenario.id;
                const isPublished = publishedScenarioId === scenario.id;
                const Icon = SCENARIO_ICONS[scenario.icon] ?? Sparkles;

                return (
                  <button
                    key={scenario.id}
                    onClick={() => onApply(scenario.id, scenario.appliances)}
                    aria-pressed={isActive}
                    title={scenario.description}
                    className={`text-left p-4 rounded-xl flex flex-col transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-white ring-2 ring-slate-900 shadow-md'
                        : isPublished
                        ? 'bg-white ring-2 ring-emerald-500 hover:shadow-md'
                        : 'bg-white ring-1 ring-slate-200 hover:ring-slate-400 hover:shadow-md'
                    }`}
                  >
                    {/* Header: icon + name + badges */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${tagMeta.tile}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0 font-semibold text-[15px] text-slate-900 leading-tight">
                        {scenario.name}
                      </span>
                      {isActive && (
                        <span className="chip bg-slate-900 text-white ring-slate-900 shrink-0">Обрано</span>
                      )}
                      {isPublished && !isActive && (
                        <span className="chip chip-live shrink-0">Опубліковано</span>
                      )}
                    </div>

                    {/* What runs when */}
                    <ul className="divide-y divide-slate-100 mb-3.5">
                      {scenario.appliances.map(a => {
                        const AIcon = APPLIANCE_ICONS[a.id];
                        const mode = !a.enabled ? 'off' : a.schedule.length === 0 ? 'always' : 'partial';
                        return (
                          <li key={a.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                            {AIcon && <AIcon className={`w-4 h-4 shrink-0 ${mode === 'off' ? 'text-slate-400' : 'text-slate-700'}`} />}
                            <span className={`font-medium ${mode === 'off' ? 'text-slate-500' : 'text-slate-800'}`}>{a.nameUa}</span>
                            <span className="sr-only">: </span>
                            <span className={`ml-auto shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                              mode === 'always' ? 'bg-emerald-100 text-emerald-800'
                              : mode === 'partial' ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-500'
                            }`}>
                              {scheduleText(a)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Outcome */}
                    <div className={`mt-auto flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                      scenario.feasible ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                    }`}>
                      <span className="flex items-center gap-1">
                        {scenario.feasible
                          ? <><Check className="w-3.5 h-3.5" strokeWidth={2.75} /> Вистачить</>
                          : <><X className="w-3.5 h-3.5" strokeWidth={2.75} /> Не вистачить</>}
                      </span>
                      <span className="font-medium">
                        {scenario.feasible
                          ? <>мін. заряд <span className="font-mono font-semibold">{Math.round(scenario.minBatteryLevel)}%</span></>
                          : <>сяде о <span className="font-mono font-semibold">{scenario.minBatteryTime}:00</span></>}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Publish bar — appears below all scenario cards */}
      {onPublish && (
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="flex flex-col items-center gap-2.5">
            <div className="inline-flex items-center gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => onPinChange?.(e.target.value)}
                placeholder="PIN"
                aria-label="PIN-код"
                className={`input w-24 text-center ${authError ? '!border-rose-500 !text-rose-700' : ''}`}
              />
                            <button
                disabled={!activeScenarioId || !pin || publishing}
                onClick={async () => {
                  const scenario = scenarios.find(s => s.id === activeScenarioId);
                  if (!scenario || !onPublish) return;
                  setPublishing(true);
                  await onPublish(scenario);
                  setPublishing(false);
                }}
                className={`btn btn-primary px-5 ${publishing ? 'cursor-wait' : ''}`}
              >
                <Share2 className="w-3.5 h-3.5" />
                {publishing ? 'Зберігаю…' : 'Опублікувати'}
              </button>
            </div>
            {authError && (
              <p className="text-xs text-rose-700 font-semibold">Невірний PIN-код</p>
            )}
            {!activeScenarioId && (
              <p className="text-xs text-slate-600">Оберіть сценарій для публікації</p>
            )}
            {publishedScenarioId && publishedAt && (
              <p className="text-xs text-slate-600">
                Опубліковано {new Date(publishedAt).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* No-outage hint */}
      {situation.totalOutageHours === 0 && (
        <p className="text-center text-xs text-slate-600 mt-4">
          Відключень не заплановано — усі сценарії будуть працювати від мережі.
        </p>
      )}
    </div>
  );
};
