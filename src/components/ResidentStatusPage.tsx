import React from 'react';
import { Droplets, Flame, Building2, Lightbulb, Zap, ZapOff, ArrowUp, ArrowDown, AlertTriangle, Minus, Clock, Gauge, Plug, ChevronRight } from 'lucide-react';
import type { TimelinePoint, BatterySettings, Appliance, PowerSchedule } from '../types';
import { getChargeColor } from '../utils/calculations';

interface Props {
  timelineData: TimelinePoint[];
  battery: BatterySettings;
  appliances: Appliance[];
  powerSchedule: PowerSchedule;
  todayFullPeriods: { start: number; end: number }[];
  tomorrowFullPeriods?: { start: number; end: number }[];
  currentTime: Date;
  tomorrowHasData?: boolean;
  deyeTimestamp?: Date | null;
  batteryPower?: number | null;
  /** Name of the published scenario (from admin) */
  sharedScenarioName?: string | null;
  /** Tag of the published scenario */
  sharedScenarioTag?: string | null;
  /** Short description of the published scenario */
  sharedScenarioDescription?: string | null;
  /** When the scenario was published */
  sharedScenarioUpdatedAt?: string | null;
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
const APPLIANCE_COLORS: Record<string, { solid: string }> = {
  heating: { solid: 'bg-rose-500' },
  water: { solid: 'bg-sky-500' },
  elevator: { solid: 'bg-violet-500' },
  lighting: { solid: 'bg-amber-500' },
};

const INACTIVE_STYLE = { solid: 'bg-slate-400' };

/** Format hour number to HH:MM string */
const fmtH = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/** One continuous stretch of the day with or without grid power (hours, 0–24) */
interface PowerSegment { start: number; end: number; on: boolean }

/** Turn the list of power-on periods into a full 0–24 sequence of on/off segments */
const buildDaySegments = (onPeriods: { start: number; end: number }[]): PowerSegment[] => {
  const sorted = [...onPeriods].filter(p => p.end > p.start).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const p of sorted) {
    const last = merged[merged.length - 1];
    if (last && p.start <= last.end) last.end = Math.max(last.end, p.end);
    else merged.push({ ...p });
  }
  const segs: PowerSegment[] = [];
  let cursor = 0;
  for (const p of merged) {
    if (p.start > cursor) segs.push({ start: cursor, end: p.start, on: false });
    segs.push({ start: p.start, end: p.end, on: true });
    cursor = p.end;
  }
  if (cursor < 24) segs.push({ start: cursor, end: 24, on: false });
  return segs;
};

/** One day of the power schedule as a plain list of on/off periods */
const DaySchedule: React.FC<{
  title: string;
  dateLabel: string;
  segments: PowerSegment[];
  /** Current time in fractional hours — only for today (hides past periods) */
  nowH?: number;
}> = ({ title, dateLabel, segments, nowH }) => {
  const visible = nowH != null ? segments.filter(s => s.end > nowH) : segments;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
        {title} <span className="font-medium normal-case tracking-normal text-slate-500">· {dateLabel}</span>
      </h3>
      <ul>
        {visible.map((s, i) => {
          const current = nowH != null && s.start <= nowH && s.end > nowH;
          return (
            <li
              key={i}
              className={`flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg ${current ? (s.on ? 'bg-emerald-50' : 'bg-rose-50') : ''}`}
            >
              <span className={`w-1.5 h-7 rounded-full shrink-0 ${s.on ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="font-mono text-[15px] font-semibold text-slate-900 tabular-nums">
                {fmtH(s.start)} – {fmtH(s.end)}
              </span>
              <span className={`ml-auto text-sm font-medium ${s.on ? 'text-emerald-800' : 'text-rose-700'}`}>
                {s.on ? 'Світло є' : 'Немає світла'}
              </span>
              {current && <span className={`chip -mr-0.5 text-white ${s.on ? 'bg-emerald-600 ring-emerald-600' : 'bg-rose-600 ring-rose-600'}`}>зараз</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const ResidentStatusPage: React.FC<Props> = ({ timelineData, battery, appliances, todayFullPeriods, tomorrowFullPeriods = [], currentTime, tomorrowHasData = true, deyeTimestamp, batteryPower }) => {
  const currentHour = currentTime.getHours();
  const levelColor = getChargeColor(battery.currentCharge);

  // Charging state from Deye inverter
  const chargeState: 'charging' | 'discharging' | 'idle' | 'unknown' =
    batteryPower == null ? 'unknown'
    : batteryPower < -50 ? 'charging'
    : batteryPower > 50 ? 'discharging'
    : 'idle';

  // Stale data detection (>30 min)
  const isStale = deyeTimestamp != null && (currentTime.getTime() - deyeTimestamp.getTime()) > 30 * 60 * 1000;
  const dataTimeStr = deyeTimestamp
    ? deyeTimestamp.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Midnight boundary for day delimiter & estimated detection
  const startHour = Math.floor(currentHour);
  const midnightIndex = startHour > 0 ? 24 - startHour : 0;

  // Tomorrow full-day periods passed from parent
  const tomorrowPeriods = tomorrowFullPeriods;

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

  const level = Math.min(100, Math.max(0, battery.currentCharge));
  const RING_R = 52;
  const RING_C = 2 * Math.PI * RING_R;

  // ── Power schedule: full on/off segments for today & tomorrow ──
  const nowH = currentTime.getHours() + currentTime.getMinutes() / 60;
  const tomorrowDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1);
  const todaySegments = buildDaySegments(todayFullPeriods);
  const tomorrowSegments = tomorrowHasData ? buildDaySegments(tomorrowPeriods) : [];

  // Hourly table rows (cut at midnight when tomorrow is unknown)
  const tableRows = (!tomorrowHasData && midnightIndex > 0) ? timelineData.slice(0, midnightIndex) : timelineData;

  const powerKw = batteryPower != null ? Math.abs(batteryPower) / 1000 : null;
  // No inverter reading yet — show placeholders instead of a scary 0%
  const awaitingData = deyeTimestamp == null;

  return (
    <div className="min-h-screen w-full px-4 py-6 md:px-6 md:py-10">
      <div className="w-full max-w-lg" style={{ margin: '0 auto' }}>

        {/* Header: title on its own line, date + live status underneath */}
        <header className="mb-5 animate-fade-up">
          <h1 className="text-xl sm:text-[1.375rem] font-bold tracking-tight text-slate-900 leading-tight">Стан батарей Русової 7А</h1>
          <div className="flex items-center gap-2 mt-1.5 text-[13px] text-slate-600">
            <span className="capitalize truncate">
              {currentTime.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
            {isStale ? (
              <span className="inline-flex items-center gap-1 shrink-0 font-semibold text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                Офлайн
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 shrink-0 font-semibold text-emerald-800">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                Наживо{dataTimeStr ? ` · ${dataTimeStr}` : ''}
              </span>
            )}
          </div>
        </header>

        {/* Big battery indicator */}
        <div className="relative overflow-hidden bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 mb-3 shadow-md animate-fade-up">
          <div
            className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-25"
            style={{ backgroundColor: awaitingData ? 'transparent' : levelColor }}
          />
          <div className="relative flex items-center gap-5 sm:gap-6">
            {/* Ring gauge */}
            <div className="relative shrink-0 w-32 h-32 sm:w-40 sm:h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={RING_R} fill="none" stroke="var(--color-slate-100)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r={RING_R} fill="none"
                  stroke={levelColor} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - (awaitingData ? 0 : level) / 100)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-baseline leading-none">
                  <span className="text-4xl sm:text-[2.75rem] font-bold tracking-tighter text-slate-900">{awaitingData ? '—' : Math.round(level)}</span>
                  {!awaitingData && <span className="text-lg font-semibold text-slate-400 ml-0.5">%</span>}
                </div>
              </div>
              {/* Direction marker at the tip of the arc: points back when discharging, forward when charging */}
              {!awaitingData && (chargeState === 'discharging' || chargeState === 'charging') && (() => {
                const deg = (level / 100) * 360;
                const rad = (deg * Math.PI) / 180;
                const x = 60 + RING_R * Math.sin(rad);
                const y = 60 - RING_R * Math.cos(rad);
                const discharging = chargeState === 'discharging';
                return (
                  <span
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${(x / 120) * 100}%`, top: `${(y / 120) * 100}%` }}
                    aria-label={discharging ? 'Розряджається' : 'Заряджається'}
                  >
                    <span className={`absolute inset-0 rounded-full animate-ping opacity-40 ${discharging ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span className={`relative grid place-items-center w-6 h-6 rounded-full bg-white shadow-md ring-2 ${discharging ? 'ring-amber-500 text-amber-600' : 'ring-emerald-500 text-emerald-600'}`}>
                      <ChevronRight className="w-4 h-4" strokeWidth={3} style={{ transform: `rotate(${discharging ? deg + 180 : deg}deg)` }} />
                    </span>
                  </span>
                );
              })()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-slate-600">{awaitingData ? 'Завантаження даних…' : 'Заряд батареї'}</div>
              {chargeState !== 'unknown' && (
                <div className={`flex items-center gap-1.5 mt-1 text-base sm:text-lg font-semibold leading-tight ${
                  chargeState === 'charging' ? 'text-emerald-700'
                  : chargeState === 'discharging' ? 'text-amber-700'
                  : 'text-slate-600'
                }`}>
                  {chargeState === 'charging' && <ArrowUp className="w-5 h-5 shrink-0" strokeWidth={2.5} />}
                  {chargeState === 'discharging' && <ArrowDown className="w-5 h-5 shrink-0" strokeWidth={2.5} />}
                  {chargeState === 'idle' && <Minus className="w-5 h-5 shrink-0" strokeWidth={2.5} />}
                  {chargeState === 'charging' ? 'Заряджається'
                    : chargeState === 'discharging' ? 'Розряджається'
                    : 'Очікування'}
                </div>
              )}
              {powerKw != null && chargeState !== 'idle' && (
                <div className="flex items-center gap-2 mt-3">
                  <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${chargeState === 'charging' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                    {chargeState === 'charging' ? <Plug className="w-4 h-4" /> : <Gauge className="w-4 h-4" />}
                  </span>
                  <div className="leading-tight">
                    <div className="text-xs text-slate-600">{chargeState === 'charging' ? 'Зарядка' : 'Споживання'}</div>
                    <div className="text-[15px] font-semibold text-slate-900 font-mono">{powerKw.toFixed(1)} кВт</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stale data warning */}
          {isStale && (
            <div className="relative mt-4 flex items-center gap-2 bg-rose-50 text-rose-600 text-xs font-medium px-3 py-2 rounded-xl ring-1 ring-inset ring-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Інвертор не оновлювався понад 30 хв — дані можуть бути неактуальні</span>
            </div>
          )}
        </div>

        {/* Power schedule */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-3 shadow-sm animate-fade-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="card-icon"><Zap /></div>
            <div>
              <h2 className="card-title">Графік світла</h2>
              <p className="card-sub">За графіком ДТЕК</p>
            </div>
          </div>

          <div className="space-y-4">
            <DaySchedule
              title="Сьогодні"
              dateLabel={currentTime.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}
              segments={todaySegments}
              nowH={nowH}
            />
            {tomorrowHasData ? (
              <DaySchedule
                title="Завтра"
                dateLabel={tomorrowDate.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}
                segments={tomorrowSegments}
              />
            ) : (
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900 mb-2.5">
                  Завтра <span className="font-normal text-slate-600 capitalize">· {tomorrowDate.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </h3>
                <div className="alert alert-warn text-[13px]">ДТЕК ще не опублікував графік на завтра</div>
              </div>
            )}
          </div>

        </div>

        {/* Hourly forecast */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up">
          <div className="p-4 sm:p-5 pb-3 sm:pb-4">
            <div className="flex items-center gap-3">
              <div className="card-icon"><Clock /></div>
              <div>
                <h2 className="card-title">Прогноз по годинах</h2>
                <p className="card-sub">
                  Заряд батареї та робота обладнання {tomorrowHasData ? 'до кінця завтра' : 'до кінця доби'}
                </p>
              </div>
            </div>
            {/* Appliance legend */}
            <div className="flex items-center gap-x-4 gap-y-1.5 mt-3.5 flex-wrap">
              {trackedAppliances.map(a => {
                const colors = APPLIANCE_COLORS[a.id] ?? INACTIVE_STYLE;
                const Icon = APPLIANCE_ICONS[a.id];
                return (
                  <div key={a.id} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                    {Icon && (
                      <span className={`grid place-items-center w-6 h-6 rounded-md ${colors.solid}`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                    <span>{APPLIANCE_LABELS[a.id] ?? a.nameUa}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                <th className="pl-4 sm:pl-5 pr-2 py-2 text-left font-semibold">Час</th>
                <th className="px-1.5 sm:px-2 py-2 text-left font-semibold">Заряд</th>
                <th className="px-1.5 sm:px-2 py-2 text-left font-semibold">Світло</th>
                <th className="pl-2 pr-4 sm:pr-5 py-2 text-right font-semibold">Працює</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((point, i) => {
                const isNow = i === 0;
                const isMidnight = i > 0 && point.time === 0;
                const isEstimated = !tomorrowHasData && midnightIndex > 0 && i >= midnightIndex;
                const isCritical = point.batteryLevel <= battery.minDischarge;
                const color = getChargeColor(point.batteryLevel);
                const activeIds = getActiveApplianceIds(point);
                const prev = tableRows[i - 1];
                const gridChanged = prev != null && prev.charging !== point.charging;

                return (
                  <React.Fragment key={i}>
                  {(i === 0 || isMidnight) && (
                    <tr>
                      <td colSpan={4} className={`pl-4 sm:pl-5 pr-4 py-1.5 bg-slate-100/80 text-xs font-semibold text-slate-800 ${i > 0 ? 'border-t border-slate-200' : ''}`}>
                        {i === 0 ? 'Сьогодні' : 'Завтра'}
                        <span className="font-normal text-slate-600 capitalize">
                          {' · '}{(i === 0 ? currentTime : tomorrowDate).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        {isMidnight && !tomorrowHasData && (
                          <span className="ml-2 text-amber-800 font-medium">≈ орієнтовно</span>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`${gridChanged ? 'border-t-2 border-slate-300' : 'border-t border-slate-100'} ${
                      isNow ? 'bg-emerald-50' : isCritical ? 'bg-rose-50' : isEstimated ? 'bg-amber-50/50' : 'bg-white'
                    }`}
                  >
                    {/* Hour */}
                    <td className="pl-4 sm:pl-5 pr-2 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[13px] font-semibold ${isNow ? 'text-emerald-900' : 'text-slate-900'}`}>
                          {String(point.time).padStart(2, '0')}:00
                        </span>
                        {isNow && <span className="sm:hidden w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                        {isNow && <span className="hidden sm:inline-flex chip bg-emerald-600 text-white ring-emerald-600 !text-[10px] !px-1.5">ЗАРАЗ</span>}
                        {isEstimated && !isNow && <span className="text-xs text-amber-700" title="Орієнтовно">≈</span>}
                      </div>
                    </td>

                    {/* Battery */}
                    <td className="px-1.5 sm:px-2 py-2.5">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-mono text-[13px] font-semibold text-slate-900 w-9 text-right tabular-nums">
                          {Math.round(point.batteryLevel)}%
                        </span>
                        <div className="w-8 sm:w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, point.batteryLevel))}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Grid */}
                    <td className="px-1.5 sm:px-2 py-2.5">
                      {point.charging ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 ${isEstimated ? 'opacity-70' : ''}`}>
                          <Zap className="w-3.5 h-3.5 fill-emerald-500 text-emerald-600" /> є
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold text-slate-700 ${isEstimated ? 'opacity-70' : ''}`}>
                          <ZapOff className="w-3.5 h-3.5" /> немає
                        </span>
                      )}
                    </td>

                    {/* Appliances */}
                    <td className="pl-1.5 sm:pl-2 pr-4 sm:pr-5 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                        {trackedAppliances.map(a => {
                          const isActive = activeIds.has(a.id);
                          const Icon = APPLIANCE_ICONS[a.id];
                          const colors = APPLIANCE_COLORS[a.id] ?? INACTIVE_STYLE;
                          return (
                            <span
                              key={a.id}
                              title={`${APPLIANCE_LABELS[a.id] ?? a.nameUa}: ${isActive ? 'працює' : 'вимкнено'}`}
                              className={`grid place-items-center w-6 h-6 rounded-md ${isActive ? colors.solid : 'bg-transparent'}`}
                            >
                              {isActive && Icon
                                ? <Icon className="w-3.5 h-3.5 text-white" />
                                : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="px-4 sm:px-5 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            Кольоровий значок — обладнання працює, крапка — вимкнено.
            {!tomorrowHasData && ' Позначка ≈ — орієнтовний прогноз.'}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 text-slate-600 text-xs">
          Автоматично оновлюється · Калькулятор батареї
        </footer>
      </div>
    </div>
  );
};
