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

  const level = Math.min(100, Math.max(0, battery.currentCharge));
  const SEGMENTS = 20;
  const filled = Math.round((level / 100) * SEGMENTS);

  return (
    <div className="card">
      {/* Prompt if charge not set */}
      {needsCharge && (
        <div className="alert alert-warn mb-5 text-center font-medium">
          ⚠️ Вкажіть поточний заряд батареї в блоці «Параметри» нижче
        </div>
      )}

      {/* Hero: charge level + clock */}
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <div className="text-[13px] font-medium text-slate-600 mb-1">Заряд батареї</div>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-5xl md:text-6xl font-bold tracking-tighter" style={{ color: chargeColor }}>
              {Math.round(level)}
            </span>
            <span className="text-2xl md:text-3xl font-semibold text-slate-400">%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-slate-600 text-[13px] mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-energy-500 animate-pulse" />
            <span className="capitalize">{dateStr}</span>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-2xl md:text-3xl font-semibold font-mono tracking-tight text-slate-900">{timeStr}</span>
          </div>
        </div>
      </div>

      {/* Segmented battery bar */}
      <div className="flex gap-[3px] h-3 mb-6" role="meter" aria-valuenow={level} aria-valuemin={0} aria-valuemax={100} aria-label="Заряд батареї">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            className="flex-1 rounded-[3px] transition-colors duration-700"
            style={{ backgroundColor: i < filled ? chargeColor : 'var(--color-slate-200)', opacity: i < filled ? 0.7 + 0.3 * ((i + 1) / filled) : 1 }}
          />
        ))}
      </div>

      {/* 4 stat cards — always grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <StatCard
          icon={<Timer className="w-3.5 h-3.5" />}
          label="Автономно"
          value={formatHours(result.hoursRemaining)}
          iconBg="bg-sky-100"
          iconColor="text-sky-600"
          valueColor="text-slate-900"
        />
        <StatCard
          icon={<Zap className="w-3.5 h-3.5" />}
          label="Споживання"
          value={`${result.currentConsumption.toFixed(1)} кВт`}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          valueColor="text-slate-900"
        />
        <StatCard
          icon={<BatteryFull className="w-3.5 h-3.5" />}
          label="Доступно"
          value={`${result.currentAvailableEnergy.toFixed(1)} кВт·г`}
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
          valueColor="text-slate-900"
        />
        <StatCard
          icon={<BatteryCharging className="w-3.5 h-3.5" />}
          label="Зарядка до макс."
          value={formatHours(result.chargeTime)}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          valueColor="text-slate-900"
        />
      </div>

      {/* Recommendations — compact row */}
      {result.recommendations.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-200">
          {result.recommendations.map((rec, i) => (
            <span
              key={i}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                rec.includes('✅')
                  ? 'bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-300'
                  : rec.includes('⚠️') || rec.includes('⏰')
                  ? 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300'
                  : 'bg-slate-50 text-slate-800 ring-1 ring-inset ring-slate-300'
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
  <div className="inset px-3.5 py-3 md:px-4 md:py-3.5">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className={`grid place-items-center w-6 h-6 rounded-lg ${iconBg} ${iconColor} shrink-0`}>{icon}</span>
      <span className="text-xs text-slate-600 font-medium truncate">{label}</span>
    </div>
    <div className={`text-base md:text-lg font-semibold tracking-tight ${valueColor} truncate`}>{value}</div>
  </div>
);
