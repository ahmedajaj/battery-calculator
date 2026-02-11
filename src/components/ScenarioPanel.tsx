import React, { useMemo } from 'react';
import { Sparkles, Check, X, Battery, Clock, Zap, ZapOff, AlertTriangle } from 'lucide-react';
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
}

const TAG_STYLES: Record<Scenario['tag'], { bg: string; text: string; label: string }> = {
  comfort:   { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Комфорт' },
  balanced:  { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Баланс' },
  economy:   { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Економія' },
  emergency: { bg: 'bg-red-50',     text: 'text-red-700',     label: 'Аварійний' },
};

const TAG_ORDER: Scenario['tag'][] = ['comfort', 'balanced', 'economy', 'emergency'];

/** Small visual battery icon with fill level + percentage */
const BatteryPictogram: React.FC<{ level: number }> = ({ level }) => {
  const color =
    level >= 60 ? 'text-green-500'
    : level >= 30 ? 'text-amber-500'
    : 'text-red-500';

  const fillColor =
    level >= 60 ? '#22c55e'
    : level >= 30 ? '#f59e0b'
    : '#ef4444';

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
      <span className="text-[11px] font-medium">{level}%</span>
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
}) => {
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
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-50 rounded-xl">
          <Sparkles className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Рекомендовані сценарії
          </h2>
          <p className="text-xs text-slate-500">
            Оберіть сценарій для зміни розкладу • {feasibleCount} з {scenarios.length} можливі
          </p>
        </div>
      </div>

      {/* Situation summary bar */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-5 px-3 py-2.5 bg-slate-50 rounded-xl text-xs">
        <div className="flex items-center gap-1.5">
          <Battery className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-slate-600">
            <span className="font-semibold">{situation.batteryPercent.toFixed(0)}%</span>
            {' '}({situation.availableEnergyKwh} кВт·год)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {situation.isPowerOnNow
            ? <Zap className="w-3.5 h-3.5 text-green-500" />
            : <ZapOff className="w-3.5 h-3.5 text-red-500" />}
          <span className="text-slate-600">
            {situation.isPowerOnNow ? 'Світло є' : 'Світла немає'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600">
            {situation.totalOutageHours > 0
              ? `${situation.totalOutageHours} год без світла`
              : 'Відключень не заплановано'}
          </span>
        </div>

        {!situation.isPowerOnNow && situation.hoursToNextPowerOn > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-600">
              Увімкнення через{' '}
              <span className="font-semibold">{situation.hoursToNextPowerOn} год</span>
            </span>
          </div>
        )}

        {situation.isPowerOnNow && situation.hoursToNextOutage > 0 && (
          <div className="flex items-center gap-1.5">
            <ZapOff className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-600">
              Вимкнення через{' '}
              <span className="font-semibold">{situation.hoursToNextOutage} год</span>
            </span>
          </div>
        )}
      </div>

      {/* Uncertainty banner when tomorrow schedule is unknown */}
      {!tomorrowHasData && (
        <div className="mb-5 px-3 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-amber-700">
              Розклад на завтра ще невідомий — оцінка за паузою між увімкненнями
            </span>
          </div>
          <div className="flex items-center gap-2 pl-5">
            <label className="text-amber-700 whitespace-nowrap">Пауза між увімк.:</label>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={offGapHours}
              onChange={(e) => onOffGapChange(Math.max(1, Math.min(20, parseFloat(e.target.value) || 7)))}
              className="w-14 bg-white border border-amber-300 rounded-lg px-2 py-1 text-sm font-mono text-slate-700 text-center focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
            />
            <span className="text-amber-600">год</span>
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
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map(scenario => {
                const isActive = activeScenarioId === scenario.id;

                return (
                  <button
                    key={scenario.id}
                    onClick={() => onApply(scenario.id, scenario.appliances)}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
                      isActive
                        ? 'border-indigo-400 bg-indigo-50/50 shadow-md ring-1 ring-indigo-200'
                        : scenario.feasible
                          ? 'border-slate-200 hover:border-blue-300 bg-white'
                          : 'border-red-200 bg-red-50/20 opacity-60'
                    }`}
                  >
                    {/* Top row: icon + name + active badge */}
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-xl leading-none mt-0.5 shrink-0">{scenario.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-800 leading-tight">
                            {scenario.name}
                          </span>
                          {isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium shrink-0">
                              Обрано
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                      {scenario.description}
                    </p>

                    {/* Metrics */}
                    <div className="flex items-center gap-3 text-[11px]">
                      <span
                        className={`flex items-center gap-1 font-medium ${
                          scenario.feasible ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {scenario.feasible
                          ? <><Check className="w-3 h-3" /> Вистачить</>
                          : <><X className="w-3 h-3" /> Не вистачить</>}
                      </span>
                      <span className="text-slate-300">•</span>
                      {scenario.feasible ? (
                        <BatteryPictogram level={scenario.minBatteryLevel} />
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">
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

      {/* No-outage hint */}
      {situation.totalOutageHours === 0 && (
        <p className="text-center text-xs text-slate-400 mt-4">
          Відключень не заплановано — усі сценарії будуть працювати від мережі.
        </p>
      )}
    </div>
  );
};
