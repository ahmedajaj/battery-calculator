import React from 'react';
import { Clock, BatteryFull, Zap, Timer, BatteryCharging } from 'lucide-react';
import type { CalculationResult, BatterySettings } from '../types';
import { formatHours, getChargeColor } from '../utils/calculations';

interface Props {
  result: CalculationResult;
  battery: BatterySettings;
  currentTime: Date;
  apiMode?: boolean;
}

export const StatusDashboard: React.FC<Props> = ({ result, battery, currentTime, apiMode = false }) => {
  const chargeColor = getChargeColor(battery.currentCharge);
  const timeStr = currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
  const needsCharge = !apiMode && battery.currentCharge === 0;

  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm">
      {/* Prompt if charge not set */}
      {needsCharge && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-center text-sm text-amber-700 font-medium">
          ⚠️ Вкажіть поточний заряд батареї в блоці «Параметри» нижче
        </div>
      )}

      {/* Top row: time */}
      <div className="flex items-center mb-4">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-lg font-bold font-mono text-slate-800">{timeStr}</span>
          <span className="text-xs text-slate-400 capitalize">{dateStr}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* Battery bar — full width */}
      <div className="mb-4">
        <div
          className="relative w-full h-10 rounded-xl overflow-hidden bg-slate-100"
          style={{ borderColor: chargeColor, borderWidth: '2px', borderStyle: 'solid' }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 transition-all duration-700 rounded-r-lg"
            style={{ width: `${battery.currentCharge}%`, backgroundColor: chargeColor, opacity: 0.75 }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-bold text-slate-800 text-lg drop-shadow-sm">
              {battery.currentCharge}%
            </span>
          </div>
        </div>
      </div>

      {/* 4 stat cards — always grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard
          icon={<Timer className="w-4 h-4" />}
          label="Автономно"
          value={formatHours(result.hoursRemaining)}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          valueColor="text-blue-700"
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Споживання"
          value={`${result.currentConsumption.toFixed(1)} кВт`}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          valueColor="text-purple-700"
        />
        <StatCard
          icon={<BatteryFull className="w-4 h-4" />}
          label="Доступно"
          value={`${result.currentAvailableEnergy.toFixed(1)} кВт·г`}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          valueColor="text-amber-700"
        />
        <StatCard
          icon={<BatteryCharging className="w-4 h-4" />}
          label="Зарядка до макс."
          value={formatHours(result.chargeTime)}
          iconBg="bg-green-50"
          iconColor="text-green-500"
          valueColor="text-green-700"
        />
      </div>

      {/* Recommendations — compact row */}
      {result.recommendations.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
          {result.recommendations.map((rec, i) => (
            <span
              key={i}
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                rec.includes('✅')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : rec.includes('⚠️') || rec.includes('⏰')
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {rec}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}> = ({ icon, label, value, iconBg, iconColor, valueColor }) => (
  <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 flex items-center gap-2.5">
    <div className={`p-1.5 rounded-lg ${iconBg} ${iconColor} shrink-0`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-[10px] text-slate-400 font-medium leading-tight truncate">{label}</div>
      <div className={`text-sm font-bold ${valueColor} leading-tight truncate`}>{value}</div>
    </div>
  </div>
);
