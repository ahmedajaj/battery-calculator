import React from 'react';
import { Battery, Droplets, Flame, Building2, Lightbulb, Zap, ZapOff, Wifi } from 'lucide-react';
import type { TimelinePoint, BatterySettings, Appliance, PowerSchedule } from '../types';
import { getChargeColor } from '../utils/calculations';

interface Props {
  timelineData: TimelinePoint[];
  battery: BatterySettings;
  appliances: Appliance[];
  powerSchedule: PowerSchedule;
  todayFullPeriods: { start: number; end: number }[];
  currentTime: Date;
  tomorrowHasData?: boolean;
}

/** Icon components for each appliance id */
const APPLIANCE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  water: Droplets,
  heating: Flame,
  elevator: Building2,
  lighting: Lightbulb,
};

/** Friendly labels for each appliance */
const APPLIANCE_LABELS: Record<string, string> = {
  water: 'Вода',
  heating: 'Опалення',
  elevator: 'Ліфт',
  lighting: 'Світло',
};

/** Color palette per appliance for active state */
const APPLIANCE_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  heating: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'text-red-500' },
  water: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'text-blue-500' },
  elevator: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: 'text-purple-500' },
  lighting: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-500' },
};

const INACTIVE_STYLE = { bg: 'bg-slate-50', text: 'text-slate-300', border: 'border-slate-100', icon: 'text-slate-300' };

/** Format hour number to HH:MM string */
const fmtH = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const ResidentStatusPage: React.FC<Props> = ({ timelineData, battery, appliances, powerSchedule, todayFullPeriods, currentTime, tomorrowHasData = true }) => {
  const currentHour = currentTime.getHours();
  const levelColor = getChargeColor(battery.currentCharge);

  // Midnight boundary for day delimiter & estimated detection
  const startHour = Math.floor(currentHour);
  const midnightIndex = startHour > 0 ? 24 - startHour : 0;

  // Tomorrow periods from the merged schedule (hours < startHour)
  const tomorrowPeriods = powerSchedule.periods
    .filter(p => p.start < startHour)
    .map(p => ({ start: Math.max(p.start, 0), end: Math.min(p.end, startHour) }))
    .filter(p => p.start < p.end);

  // Build the list of appliance IDs we want to track (only enabled ones)
  const trackedAppliances = appliances.filter(a => a.enabled);

  // Determine which appliances are active at each hour from timelineData
  const getActiveApplianceIds = (point: TimelinePoint): Set<string> => {
    const nameSet = new Set(point.appliances); // these are nameUa strings
    const ids = new Set<string>();
    for (const a of appliances) {
      if (nameSet.has(a.nameUa)) ids.add(a.id);
    }
    return ids;
  };

  return (
    <div className="min-h-screen w-full px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10 bg-slate-50">
      <div className="w-full max-w-lg" style={{ margin: '0 auto' }}>

        {/* Header */}
        <header className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800 mb-1">Стан батарей Русової 7А</h1>
          <p className="text-sm text-slate-400">
            {currentTime.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </header>

        {/* Big battery indicator */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${levelColor}15` }}>
                <Battery className="w-6 h-6" style={{ color: levelColor }} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Заряд батареї</p>
                <p className="text-3xl font-bold" style={{ color: levelColor }}>
                  {Math.round(battery.currentCharge)}%
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold bg-green-50 text-green-600 px-2.5 py-1 rounded-full border border-green-200">
              <Wifi className="w-3 h-3" />
              LIVE
            </span>
          </div>
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(0, battery.currentCharge))}%`,
                backgroundColor: levelColor,
              }}
            />
          </div>
        </div>

        {/* Today / Tomorrow status cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Сьогодні</p>
            </div>
            {todayFullPeriods.length > 0 ? (
              <div className="space-y-1">
                {todayFullPeriods.map((p, i) => {
                  const passed = p.end <= startHour;
                  const active = p.start <= startHour && p.end > startHour;
                  return (
                    <div key={i} className={`flex items-center gap-1.5 ${passed ? 'opacity-35' : ''}`}>
                      <Zap className={`w-3 h-3 ${active ? 'text-green-500 animate-pulse' : passed ? 'text-slate-400' : 'text-green-500'}`} />
                      <span className={`text-xs font-mono font-semibold ${passed ? 'text-slate-400 line-through' : active ? 'text-green-700' : 'text-slate-700'}`}>{fmtH(p.start)} – {fmtH(p.end)}</span>
                      {active && <span className="text-[9px] text-green-600 font-bold">ЗАРАЗ</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-red-500 font-medium">Немає електрики</p>
            )}
          </div>
          <div className={`bg-white rounded-xl border p-3 shadow-sm ${tomorrowHasData ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full ${tomorrowHasData ? 'bg-green-500' : 'bg-amber-500'}`} />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Завтра</p>
            </div>
            {tomorrowHasData ? (
              tomorrowPeriods.length > 0 ? (
                <div className="space-y-1">
                  {tomorrowPeriods.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-mono font-semibold text-slate-700">{fmtH(p.start)} – {fmtH(p.end)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-red-500 font-medium">Немає електрики</p>
              )
            ) : (
              <p className="text-xs text-amber-600 font-medium">Графік ще не опубліковано</p>
            )}
          </div>
        </div>

        {/* Explanation for residents */}
        <div className="bg-slate-100/70 rounded-xl px-4 py-3 mb-4 text-xs text-slate-500 space-y-1">
          <p>📋 <b className="text-slate-600">Таблиця нижче</b> — це <b>прогноз</b> роботи обладнання на найближчі 24 години з поточної години.</p>
          <p>🔋 Рівень батареї оновлюється в реальному часі з інвертора.</p>
          {!tomorrowHasData && (
            <p>⚠️ Графік на завтра ще не опубліковано Yasno — після півночі показано <b>орієнтовний</b> розклад (за сьогоднішнім шаблоном).</p>
          )}
        </div>

        {/* Appliance legend */}
        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
          {trackedAppliances.map(a => {
            const colors = APPLIANCE_COLORS[a.id] ?? INACTIVE_STYLE;
            const Icon = APPLIANCE_ICONS[a.id];
            return (
              <div key={a.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                {Icon && <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />}
                <span>{APPLIANCE_LABELS[a.id] ?? a.nameUa}</span>
              </div>
            );
          })}
        </div>

        {/* Hourly table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="px-3 py-2.5 text-left font-semibold">Час</th>
                <th className="px-3 py-2.5 text-center font-semibold">Батарея</th>
                <th className="px-3 py-2.5 text-center font-semibold">Мережа</th>
                {trackedAppliances.map(a => {
                  const Icon = APPLIANCE_ICONS[a.id];
                  return (
                    <th key={a.id} className="px-2 py-2.5 text-center font-semibold">
                      {Icon ? <Icon className="w-3.5 h-3.5 mx-auto text-slate-400" /> : a.nameUa}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timelineData.map((point, i) => {
                const isNow = i === 0;
                const isMidnight = i > 0 && point.time === 0;
                const isEstimated = !tomorrowHasData && midnightIndex > 0 && i >= midnightIndex;
                const isCritical = point.batteryLevel <= battery.minDischarge;
                const isLow = point.batteryLevel <= battery.minDischarge + 15;
                const color = getChargeColor(point.batteryLevel);
                const activeIds = getActiveApplianceIds(point);

                const hourLabel = point.time;
                const isCurrentHour = point.time === currentHour && i === 0;
                const colSpan = 3 + trackedAppliances.length;

                return (
                  <React.Fragment key={i}>
                  {/* Midnight delimiter */}
                  {isMidnight && (
                    <tr className="bg-indigo-50/80">
                      <td colSpan={colSpan} className="px-3 py-1.5 text-center">
                        <span className="text-[11px] font-semibold text-indigo-600">🌙 Нова доба — 00:00</span>
                        {!tomorrowHasData && (
                          <span className="ml-2 text-[10px] text-amber-600 font-medium">⚠ графік орієнтовний</span>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`border-t border-slate-100 transition-colors ${
                      isCurrentHour
                        ? 'bg-blue-50/70'
                        : isCritical
                        ? 'bg-red-50/40'
                        : isLow
                        ? 'bg-amber-50/30'
                        : isEstimated
                        ? 'bg-amber-50/20'
                        : i % 2 === 0
                        ? 'bg-white'
                        : 'bg-slate-50/40'
                    }`}
                  >
                    {/* Hour */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isNow && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                        <span className={`font-mono font-semibold text-xs ${isNow ? 'text-blue-700' : 'text-slate-600'}`}>
                          {hourLabel}:00
                        </span>
                        {isNow && <span className="text-[9px] text-blue-500 font-bold">ЗАРАЗ</span>}
                        {isEstimated && !isNow && <span className="text-[9px] text-amber-500">~</span>}
                      </div>
                    </td>

                    {/* Battery bar */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-14 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, point.batteryLevel))}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Grid power */}
                    <td className="px-3 py-2.5 text-center">
                      {isEstimated ? (
                        point.charging ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-dashed border-amber-300">
                            <Zap className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-400 px-2 py-0.5 rounded-full border border-dashed border-amber-200">
                            <ZapOff className="w-3 h-3" />
                          </span>
                        )
                      ) : (
                        point.charging ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            <Zap className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-400 px-2 py-0.5 rounded-full">
                            <ZapOff className="w-3 h-3" />
                          </span>
                        )
                      )}
                    </td>

                    {/* Appliance statuses */}
                    {trackedAppliances.map(a => {
                      const isActive = activeIds.has(a.id);
                      const colors = isActive
                        ? (APPLIANCE_COLORS[a.id] ?? INACTIVE_STYLE)
                        : INACTIVE_STYLE;
                      const Icon = APPLIANCE_ICONS[a.id];
                      return (
                        <td key={a.id} className="px-2 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border ${colors.bg} ${colors.border} transition-all ${
                              isActive ? 'scale-100' : 'scale-90 opacity-40'
                            }`}
                          >
                            {Icon && <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 text-slate-300 text-xs">
          Автоматично оновлюється · Калькулятор батареї
        </footer>
      </div>
    </div>
  );
};
