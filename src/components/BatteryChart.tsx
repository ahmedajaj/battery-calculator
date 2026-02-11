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
import { BarChart3, Table2, ChevronDown } from 'lucide-react';
import type { TimelinePoint, BatterySettings, PowerSchedule } from '../types';
import { getChargeColor } from '../utils/calculations';

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
    if (onLabel) powerRefLines.push({ label: onLabel, color: onEstimated ? '#d97706' : '#22c55e', text: onEstimated ? '⚡ Увімк (оцінка)' : '⚡ Увімк', estimated: onEstimated });
    if (offLabel) powerRefLines.push({ label: offLabel, color: offEstimated ? '#d97706' : '#ef4444', text: offEstimated ? '❌ Вимк (оцінка)' : '❌ Вимк', estimated: offEstimated });
  }
  void currentHour; // used for reactivity

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as TimelinePoint;
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-lg">
          <p className="text-slate-800 font-semibold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              🔋 Заряд: <span className="font-mono font-semibold">{data.batteryLevel.toFixed(1)}%</span>
            </p>
            <p className="text-purple-600">
              ⚡ Споживання: <span className="font-mono font-semibold">{data.consumption.toFixed(1)} кВт</span>
            </p>
            <p className={data.charging ? 'text-green-600' : 'text-red-600'}>
              {data.charging ? '🔌 Зарядка' : '🔋 Розряд'}
            </p>
            {data.appliances.length > 0 && (
              <p className="text-slate-500 text-xs mt-2">
                Активно: {data.appliances.join(', ')}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-50 rounded-xl">
          <BarChart3 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Прогноз заряду батареї</h2>
          <p className="text-sm text-slate-500">Прогноз на 24 години починаючи з поточного часу</p>
        </div>
      </div>

      <div className="h-52 sm:h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

            <XAxis
              dataKey="timeLabel"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 10 }}
              interval={3}
            />
            <YAxis
              yAxisId="battery"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              yAxisId="consumption"
              orientation="right"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 12 }}
              domain={[0, 'auto']}
              tickFormatter={(value) => `${value}кВт`}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Min discharge line */}
            <ReferenceLine
              yAxisId="battery"
              y={battery.minDischarge}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: `Мін: ${battery.minDischarge}%`,
                fill: '#ef4444',
                fontSize: 11,
                position: 'right',
              }}
            />

            {/* Max charge line */}
            <ReferenceLine
              yAxisId="battery"
              y={battery.maxCharge}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{
                value: `Макс: ${battery.maxCharge}%`,
                fill: '#22c55e',
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
                  fill: '#6366f1',
                  fontSize: 10,
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
                  fill: '#d97706',
                  fontSize: 10,
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
                  fontSize: 10,
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
              stroke="#3b82f6"
              strokeWidth={3}
              fill="url(#batteryGradient)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 mt-4 text-xs sm:text-sm bg-slate-50 py-2 sm:py-3 rounded-xl flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span className="text-slate-600">Рівень заряду</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500" />
          <span className="text-slate-600">Споживання</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-red-500" />
          <span className="text-slate-600">Ліміти</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-l-2 border-dashed border-indigo-500" />
          <span className="text-slate-600">Північ</span>
        </div>
        {powerRefLines.some(l => l.estimated) && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-l-2 border-dashed border-amber-600" />
            <span className="text-slate-600">Оцінка</span>
          </div>
        )}
      </div>

      {/* Data table (collapsible) */}
      <div className="mt-4">
        <button
          onClick={() => setTableOpen(!tableOpen)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 transition-colors"
        >
          <Table2 className="w-4 h-4" />
          Погодинна таблиця
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${tableOpen ? 'rotate-180' : ''}`} />
        </button>

        {tableOpen && (
          <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
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
                            <span className="text-[11px] font-semibold text-indigo-600">🌙 Нова доба — 00:00</span>
                            {!tomorrowHasData && (
                              <span className="ml-2 text-[10px] text-amber-600 font-medium">⚠ Немає даних ДТЕК</span>
                            )}
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`border-t border-slate-100 transition-colors ${
                          isNow
                            ? 'bg-blue-50/60'
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
                            {isNow && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                            <span className={`font-mono font-medium ${isNow ? 'text-blue-700' : 'text-slate-700'}`}>
                              {point.time}:00
                            </span>
                            {isNow && <span className="text-[10px] text-blue-500 font-semibold">ЗАРАЗ</span>}
                            {isUncertain && <span className="text-[10px] text-amber-500">⚠</span>}
                          </div>
                        </td>

                        {/* Battery level with mini bar */}
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, point.batteryLevel))}%`,
                                  backgroundColor: levelColor,
                                }}
                              />
                            </div>
                            <span
                              className="font-mono font-bold text-xs min-w-[3.5rem] text-right"
                              style={{ color: levelColor }}
                            >
                              {point.batteryLevel.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Consumption */}
                        <td className="px-3 py-2 text-right">
                          {point.consumption > 0 ? (
                            <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100">
                              {point.consumption.toFixed(1)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-slate-300">0.0</span>
                          )}
                        </td>

                        {/* Power status */}
                        <td className="px-3 py-2 text-center">
                          {point.charging ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                              ⚡ Так
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-full border border-red-100">
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
                                  className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
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
            <div className="flex items-center justify-center gap-4 py-2 px-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Поточна година</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-200" /> Критичний рівень</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-200" /> Низький рівень</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
