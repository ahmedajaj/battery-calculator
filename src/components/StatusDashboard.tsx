import React from 'react';
import { Battery, Clock, Zap, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import type { CalculationResult, BatterySettings } from '../types';
import { formatHours, getChargeColor } from '../utils/calculations';

interface Props {
  result: CalculationResult;
  battery: BatterySettings;
  currentTime: Date;
}

export const StatusDashboard: React.FC<Props> = ({ result, battery, currentTime }) => {
  const chargeColor = getChargeColor(battery.currentCharge);
  const timeStr = currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
      {/* Current time display */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-slate-400" />
          <div>
            <div className="text-3xl font-bold font-mono text-slate-800">{timeStr}</div>
            <div className="text-sm text-slate-500 capitalize">{dateStr}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Моніторинг активний
        </div>
      </div>

      {/* Main battery indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="relative w-24 h-12 rounded-lg border-3 flex items-center overflow-hidden bg-slate-100"
            style={{ borderColor: chargeColor, borderWidth: '3px' }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-500"
              style={{
                width: `${battery.currentCharge}%`,
                backgroundColor: chargeColor,
                opacity: 0.8,
              }}
            />
            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-5 rounded-r-sm" style={{ backgroundColor: chargeColor }} />
            <span className="relative z-10 w-full text-center font-bold text-slate-800 text-lg">
              {battery.currentCharge}%
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Стан батареї</h3>
            <p className="text-sm text-slate-500">
              {result.currentAvailableEnergy.toFixed(1)} кВт·год доступно
            </p>
          </div>
        </div>

        <div
          className={`px-5 py-2.5 rounded-full flex items-center gap-2 font-medium ${
            result.canSurviveOutage
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}
        >
          {result.canSurviveOutage ? (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Заряду вистачить</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5" />
              <span>Заряду не вистачить</span>
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Час роботи"
          value={formatHours(result.hoursRemaining)}
          color="text-blue-600"
          bgColor="bg-blue-50"
          borderColor="border-blue-100"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="Споживання зараз"
          value={`${result.currentConsumption.toFixed(1)} кВт`}
          color="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-100"
        />
        <StatCard
          icon={<Battery className="w-5 h-5" />}
          label="До повної зарядки"
          value={formatHours(result.chargeTime)}
          color="text-green-600"
          bgColor="bg-green-50"
          borderColor="border-green-100"
        />
        <StatCard
          icon={<TrendingDown className="w-5 h-5" />}
          label="Доступно енергії"
          value={`${result.currentAvailableEnergy.toFixed(1)} кВт·год`}
          color="text-amber-600"
          bgColor="bg-amber-50"
          borderColor="border-amber-100"
        />
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Рекомендації
        </h4>
        <div className="space-y-2">
          {result.recommendations.map((rec, index) => (
            <div
              key={index}
              className={`p-3 rounded-xl text-sm font-medium ${
                rec.includes('✅')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : rec.includes('⚠️') || rec.includes('⏰')
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {rec}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = ({ icon, label, value, color, bgColor, borderColor }) => (
  <div className={`${bgColor} rounded-xl p-4 border ${borderColor}`}>
    <div className={`${color} mb-2`}>{icon}</div>
    <div className="text-xs text-slate-500 mb-1 font-medium">{label}</div>
    <div className={`text-xl font-bold ${color}`}>{value}</div>
  </div>
);
