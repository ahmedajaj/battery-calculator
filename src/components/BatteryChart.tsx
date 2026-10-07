import React, { useState } from 'react';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
  Bar,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { BarChart3, Table2, ChevronDown } from 'lucide-react';
import type { TimelinePoint, BatterySettings, PowerSchedule } from '../types';
import { getChargeColor } from '../utils/calculations';

const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as TimelinePoint;
    return (
      <div className="bg-white/95 backdrop-blur ring-1 ring-slate-200 rounded-xl p-3.5 shadow-lg">
        <p className="text-slate-900 font-semibold font-mono mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="text-sky-700">
            🔋 Заряд: <span className="font-mono font-semibold">{data.batteryLevel.toFixed(1)}%</span>
          </p>
          <p className="text-violet-700">
            ⚡ Споживання: <span className="font-mono font-semibold">{data.consumption.toFixed(1)} кВт</span>
          </p>
          <p className={data.charging ? 'text-emerald-800' : 'text-rose-700'}>
            {data.charging ? '🔌 Зарядка' : '🔋 Розряд'}
          </p>
          {data.appliances.length > 0 && (
            <p className="text-slate-600 text-xs mt-2">
              Активно: {data.appliances.join(', ')}
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

interface Props {
  timelineData: TimelinePoint[];
  battery: BatterySettings;
  powerSchedule: PowerSchedule;
  currentHour: number;
  tomorrowHasData?: boolean;
}

export const BatteryChart: React.FC<Props> = ({ timelineData, battery, powerSchedule, currentHour, tomorrowHasData = true }) => {
  const [tableOpen, setTableOpen] = useState(false);

  const chartData = timelineData.map((point, index) => ({
    ...point,
    timeLabel: index === 0 ? `▶ ${point.time}:00` : `${point.time}:00`,
    batteryLevel: point.batteryLevel,
    consumption: point.consumption,
  }));

  // Midnight label for the day boundary line
  const startHour = Math.floor(currentHour);
  const midnightIndex = startHour > 0 ? 24 - startHour : 0;
  const midnightLabel = midnightIndex > 0 && midnightIndex < 24
    ? chartData[midnightIndex]?.timeLabel
    : null;

  // Uncertainty area: labels from midnight to end when tomorrow has no data
  const uncertaintyStart = !tomorrowHasData && midnightLabel ? midnightLabel : null;
  const uncertaintyEnd = !tomorrowHasData && midnightLabel ? chartData[chartData.length - 1]?.timeLabel : null;

  // Collect power schedule boundary reference lines
  // When tomorrow has no data, periods in the tomorrow zone (hour < startHour) are estimated
  const powerRefLines: { label: string; color: string; text: string; estimated: boolean }[] = [];
  for (const period of powerSchedule.periods) {
    const onHour = Math.round(period.start) % 24;
    const offHour = Math.round(period.end) % 24;
    const onLabel = chartData.find(d => d.time === onHour)?.timeLabel;
    const offLabel = chartData.find(d => d.time === offHour)?.timeLabel;
    const onEstimated = !tomorrowHasData && onHour < startHour;
    const offEstimated = !tomorrowHasData && offHour < startHour;
    if (onLabel) powerRefLines.push({ label: onLabel, color: onEstimated ? '#b45309' : '#047857', text: onEstimated ? '⚡ Увімк (оцінка)' : '⚡ Увімк', estimated: onEstimated });
    if (offLabel) powerRefLines.push({ label: offLabel, color: offEstimated ? '#b45309' : '#be123c', text: offEstimated ? '❌ Вимк (оцінка)' : '❌ Вимк', estimated: offEstimated });
  }
  void currentHour; // used for reactivity

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-icon"><BarChart3 /></div>
        <div>
          <h2 className="card-title">Прогноз заряду батареї</h2>
          <p className="card-sub">Прогноз на 24 години починаючи з поточного часу</p>
        </div>
      </div>

      <div className="h-52 sm:h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.15} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

            <XAxis
              dataKey="timeLabel"
              stroke="#cbd5e1"
              tick={{ fill: '#334155', fontSize: 11 }}
              interval={3}
            />
            <YAxis
              yAxisId="battery"
              stroke="#cbd5e1"
              tick={{ fill: '#334155', fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              yAxisId="consumption"
              orientation="right"
              stroke="#cbd5e1"
              tick={{ fill: '#334155', fontSize: 11 }}
              domain={[0, 'auto']}
              tickFormatter={(value) => `${value}кВт`}
            />

            <Tooltip content={CustomTooltip} />

            {/* Min discharge line */}
            <ReferenceLine
              yAxisId="battery"
              y={battery.minDischarge}
              stroke="#e11d48"
              strokeDasharray="5 5"
              label={{
                value: `Мін: ${battery.minDischarge}%`,
                fill: '#be123c',
                fontSize: 11,
                position: 'right',
              }}
            />

            {/* Max charge line */}
            <ReferenceLine
              yAxisId="battery"
              y={battery.maxCharge}
              stroke="#059669"
              strokeDasharray="5 5"
              label={{
                value: `Макс: ${battery.maxCharge}%`,
                fill: '#047857',
                fontSize: 11,
                position: 'right',
              }}
            />

            {/* Midnight day boundary */}
            {midnightLabel && (
              <ReferenceLine
                yAxisId="battery"
                x={midnightLabel}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="6 3"
                label={{
                  value: '🌙 00:00',
                  fill: '#4338ca',
                  fontSize: 11,
                  position: 'top',
                }}
              />
            )}

            {/* Uncertainty area when tomorrow data is missing */}
            {uncertaintyStart && uncertaintyEnd && (
              <ReferenceArea
                yAxisId="battery"
                x1={uncertaintyStart}
                x2={uncertaintyEnd}
                fill="#f59e0b"
                fillOpacity={0.08}
                stroke="#f59e0b"
                strokeOpacity={0.3}
                strokeDasharray="4 4"
                label={{
                  value: '⚠ Немає даних на завтра',
                  fill: '#b45309',
                  fontSize: 11,
                  position: 'insideTop',
                }}
              />
            )}

            {/* Power on/off indicators */}
            {powerRefLines.map((line, i) => (
              <ReferenceLine
                key={`power-${i}`}
                yAxisId="battery"
                x={line.label}
                stroke={line.color}
                strokeWidth={line.estimated ? 1.5 : 2}
                strokeDasharray={line.estimated ? '6 3' : undefined}
                label={{
                  value: line.text,
                  fill: line.color,
                  fontSize: 11,
                  fontWeight: 600,
                  position: 'top',
                }}
              />
            ))}

            {/* Consumption bars */}
            <Bar
              yAxisId="consumption"
              dataKey="consumption"
              fill="url(#consumptionGradient)"
              radius={[2, 2, 0, 0]}
              opacity={0.7}
            />

            {/* Battery level area */}
            <Area
              yAxisId="battery"
              type="monotone"
              dataKey="batteryLevel"
              stroke="#0284c7"
              strokeWidth={2.5}
              fill="url(#batteryGradient)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 mt-4 text-xs sm:text-[13px] inset py-2.5 px-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-sky-600" />
          <span className="text-slate-800 font-medium">Рівень заряду</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-violet-500" />
          <span className="text-slate-800 font-medium">Споживання</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-rose-600" />
          <span className="text-slate-800 font-medium">Ліміти</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-l-2 border-dashed border-indigo-500" />
          <span className="text-slate-800 font-medium">Північ</span>
        </div>
        {powerRefLines.some(l => l.estimated) && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-l-2 border-dashed border-amber-600" />
            <span className="text-slate-800 font-medium">Оцінка</span>
          </div>
        )}
      </div>

      {/* Data table (collapsible) */}
      <div className="mt-4">
        <button
          onClick={() => setTableOpen(!tableOpen)}
          className="btn btn-secondary w-full"
          aria-expanded={tableOpen}
        >
          <Table2 className="w-4 h-4" />
          Погодинна таблиця
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${tableOpen ? 'rotate-180' : ''}`} />
        </button>

        {tableOpen && (
          <div className="mt-3 rounded-xl ring-1 ring-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700">
                    <th className="px-3 py-2.5 text-left font-semibold text-xs whitespace-nowrap">🕐 Час</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-xs whitespace-nowrap">🔋 Заряд</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-xs whitespace-nowrap">⚡ кВт</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">💡 Мережа</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-xs whitespace-nowrap hidden sm:table-cell">📋 Прилади</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineData.map((point, i) => {
                    const levelColor = getChargeColor(point.batteryLevel);
                    const isNow = i === 0;
                    const isMidnight = i > 0 && point.time === 0;
                    const isUncertain = !tomorrowHasData && midnightIndex > 0 && i >= midnightIndex;
                    const isCritical = point.batteryLevel <= battery.minDischarge;
                    const isLow = point.batteryLevel <= battery.minDischarge + 15;

                    return (
                      <React.Fragment key={i}>
                      {isMidnight && (
                        <tr className="bg-indigo-50/80">
                          <td colSpan={5} className="px-3 py-1.5 text-center">
                            <span className="text-xs font-semibold text-indigo-700">🌙 Нова доба — 00:00</span>
                            {!tomorrowHasData && (
                              <span className="ml-2 text-[11px] text-amber-800 font-medium">⚠ Немає даних ДТЕК</span>
                            )}
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`border-t border-slate-100 transition-colors ${
                          isNow
                            ? 'bg-emerald-50/70'
                            : isCritical
                            ? 'bg-red-50/50'
                            : isLow
                            ? 'bg-amber-50/40'
                            : isUncertain
                            ? 'bg-amber-50/30'
                            : i % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/40'
                        }`}
                      >
                        {/* Time */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            <span className={`font-mono font-medium ${isNow ? 'text-emerald-800 font-semibold' : 'text-slate-800'}`}>
                              {point.time}:00
                            </span>
                            {isNow && <span className="text-[11px] text-emerald-800 font-bold">ЗАРАЗ</span>}
                            {isUncertain && <span className="text-[11px] text-amber-800">⚠</span>}
                          </div>
                        </td>

                        {/* Battery level with mini bar */}
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, point.batteryLevel))}%`,
                                  backgroundColor: levelColor,
                                }}
                              />
                            </div>
                            <span
                              className="font-mono font-semibold text-xs min-w-[3.5rem] text-right text-slate-900"
                            >
                              {point.batteryLevel.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Consumption */}
                        <td className="px-3 py-2 text-right">
                          {point.consumption > 0 ? (
                            <span className="font-mono text-xs font-medium bg-violet-50 text-violet-800 px-2 py-0.5 rounded-md ring-1 ring-inset ring-violet-200">
                              {point.consumption.toFixed(1)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">0.0</span>
                          )}
                        </td>

                        {/* Power status */}
                        <td className="px-3 py-2 text-center">
                          {point.charging ? (
                            <span className="chip chip-live">
                              ⚡ Так
                            </span>
                          ) : (
                            <span className="chip chip-error">
                              ✕ Ні
                            </span>
                          )}
                        </td>

                        {/* Active appliances */}
                        <td className="px-3 py-2 hidden sm:table-cell">
                          {point.appliances.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {point.appliances.map((name, j) => (
                                <span
                                  key={j}
                                  className="text-[11px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md ring-1 ring-inset ring-slate-200"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table legend */}
            <div className="flex items-center justify-center gap-4 py-2.5 px-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-700 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Поточна година</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-200" /> Критичний рівень</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-200" /> Низький рівень</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
