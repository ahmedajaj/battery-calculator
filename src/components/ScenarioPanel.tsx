import React, { useMemo, useState } from 'react';
import { Sparkles, Check, X, Battery, Clock, Zap, ZapOff, AlertTriangle, Share2 } from 'lucide-react';
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

const TAG_STYLES: Record<Scenario['tag'], { bg: string; text: string; label: string }> = {
  comfort:   { bg: 'bg-emerald-50', text: 'text-emerald-800', label: 'Комфорт' },
  balanced:  { bg: 'bg-sky-50',     text: 'text-sky-800',     label: 'Баланс' },
  economy:   { bg: 'bg-amber-50',   text: 'text-amber-800',   label: 'Економія' },
  emergency: { bg: 'bg-rose-50',    text: 'text-rose-800',    label: 'Аварійний' },
};

const TAG_ORDER: Scenario['tag'][] = ['comfort', 'balanced', 'economy', 'emergency'];

/** Small visual battery icon with fill level + percentage */
const BatteryPictogram: React.FC<{ level: number }> = ({ level }) => {
  const color =
    level >= 60 ? 'text-emerald-800'
    : level >= 30 ? 'text-amber-800'
    : 'text-rose-700';

  const fillColor =
    level >= 60 ? '#10b981'
    : level >= 30 ? '#f59e0b'
    : '#f43f5e';

  // SVG battery with dynamic fill
  const fillWidth = Math.max(0, Math.min(100, level));

  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <svg width="20" height="11" viewBox="0 0 20 11" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Battery body */}
        <rect x="0.5" y="0.5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1" fill="none" />
        {/* Fill */}
        <rect x="1.5" y="1.5" width={`${fillWidth * 0.14}`} height="8" rx="1" fill={fillColor} opacity="0.8" />
        {/* Terminal nub */}
        <rect x="17" y="3" width="2.5" height="5" rx="1" fill="currentColor" opacity="0.5" />
      </svg>
      <span className="text-xs font-semibold">{level}%</span>
    </span>
  );
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

                return (
                  <button
                    key={scenario.id}
                    onClick={() => onApply(scenario.id, scenario.appliances)}
                    aria-pressed={isActive}
                    className={`text-left p-4 rounded-xl transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-white ring-2 ring-slate-900 shadow-md'
                        : isPublished
                        ? 'bg-emerald-50/60 ring-1 ring-emerald-400 hover:shadow-md'
                        : scenario.feasible
                          ? 'bg-white ring-1 ring-slate-200 hover:ring-slate-400 hover:shadow-md'
                          : 'bg-slate-50 ring-1 ring-inset ring-slate-200 hover:ring-slate-300'
                    }`}
                  >
                    {/* Top row: icon + name + badges */}
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-xl leading-none mt-0.5 shrink-0">{scenario.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 leading-tight">
                            {scenario.name}
                          </span>
                          {isActive && (
                            <span className="chip bg-slate-900 text-white ring-slate-900 shrink-0">
                              Обрано
                            </span>
                          )}
                          {isPublished && !isActive && (
                            <span className="chip chip-live shrink-0">
                              Опубл.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[13px] text-slate-600 mb-3 leading-relaxed">
                      {scenario.description}
                    </p>

                    {/* Metrics */}
                    <div className="flex items-center gap-3 text-xs">
                      <span
                        className={`flex items-center gap-1 font-semibold ${
                          scenario.feasible ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {scenario.feasible
                          ? <><Check className="w-3 h-3" /> Вистачить</>
                          : <><X className="w-3 h-3" /> Не вистачить</>}
                      </span>
                      <span className="text-slate-400">•</span>
                      {scenario.feasible ? (
                        <BatteryPictogram level={scenario.minBatteryLevel} />
                      ) : (
                        <span className="flex items-center gap-1 font-medium text-rose-700">
                          <Clock className="w-3 h-3" />
                          о {scenario.minBatteryTime}:00
                        </span>
                      )}
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
