import React from 'react';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { TimelinePoint, BatterySettings, PowerSchedule } from '../types';

interface Props {
  timelineData: TimelinePoint[];
  battery: BatterySettings;
  powerSchedule: PowerSchedule;
  currentHour: number;
}

export const BatteryChart: React.FC<Props> = ({ timelineData, battery, powerSchedule, currentHour }) => {
  const chartData = timelineData.map((point, index) => ({
    ...point,
    timeLabel: index === 0 ? `▶ ${point.time}:00` : `${point.time}:00`,
    batteryLevel: point.batteryLevel,
    consumption: point.consumption,
  }));

  // Collect power schedule boundary reference lines
  const powerRefLines: { label: string; color: string; text: string }[] = [];
  for (const period of powerSchedule.periods) {
    const onLabel = chartData.find(d => d.time === period.start)?.timeLabel;
    const offLabel = chartData.find(d => d.time === period.end % 24)?.timeLabel;
    if (onLabel) powerRefLines.push({ label: onLabel, color: '#22c55e', text: '⚡ Увімк' });
    if (offLabel) powerRefLines.push({ label: offLabel, color: '#ef4444', text: '❌ Вимк' });
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
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-50 rounded-xl">
          <BarChart3 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Прогноз заряду батареї</h2>
          <p className="text-sm text-slate-500">Прогноз на 24 години починаючи з поточного часу</p>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
              tick={{ fill: '#64748b', fontSize: 12 }}
              interval={2}
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

            {/* Power on/off indicators */}
            {powerRefLines.map((line, i) => (
              <ReferenceLine
                key={`power-${i}`}
                x={line.label}
                stroke={line.color}
                strokeWidth={2}
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
      <div className="flex items-center justify-center gap-6 mt-4 text-sm bg-slate-50 py-3 rounded-xl">
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
      </div>
    </div>
  );
};
