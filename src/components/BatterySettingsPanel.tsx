import React from 'react';
import { Battery, Zap, BatteryCharging, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import type { BatterySettings } from '../types';

interface Props {
  settings: BatterySettings;
  onChange: (settings: BatterySettings) => void;
}

const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-sm text-slate-800 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all";

export const BatterySettingsPanel: React.FC<Props> = ({ settings, onChange }) => {
  const handleChange = (key: keyof BatterySettings, value: number) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-50 rounded-xl">
          <Battery className="w-4 h-4 text-blue-600" />
        </div>
        <h2 className="text-base font-semibold text-slate-800">Налаштування батареї</h2>
      </div>

      {/* Current Charge — highlighted, always on top */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-4 flex items-center gap-3">
        <Zap className="w-4 h-4 text-amber-500 shrink-0" />
        <label className="text-sm font-semibold text-amber-700 whitespace-nowrap">Поточний заряд</label>
        <div className="relative flex-1 max-w-[120px]">
          <input
            type="number"
            min="0"
            max="100"
            value={settings.currentCharge || ''}
            placeholder="—"
            onChange={(e) => handleChange('currentCharge', parseInt(e.target.value) || 0)}
            className="w-full bg-white border-2 border-amber-300 rounded-md px-2.5 py-1.5 text-amber-800 font-mono font-bold text-base focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-amber-300"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 text-xs font-semibold">%</span>
        </div>
        <span className="text-xs text-amber-500 hidden sm:inline">⟵ вкажіть щоразу</span>
      </div>

      {/* Config fields — compact row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Ємність" unit="кВт·год" icon={<Battery className="w-3.5 h-3.5 text-blue-500" />}>
          <input type="number" min="1" max="500" step="0.5" value={settings.capacity}
            onChange={(e) => handleChange('capacity', parseFloat(e.target.value) || 1)} className={inputCls} />
        </Field>
        <Field label="Зарядка" unit="кВт" icon={<BatteryCharging className="w-3.5 h-3.5 text-green-500" />}>
          <input type="number" min="0.5" max="100" step="0.5" value={settings.chargingPower}
            onChange={(e) => handleChange('chargingPower', parseFloat(e.target.value) || 0.5)} className={inputCls} />
        </Field>
        <Field label="Мін. розряд" unit="%" icon={<ArrowDownToLine className="w-3.5 h-3.5 text-red-500" />}>
          <input type="number" min="0" max={settings.maxCharge - 5} value={settings.minDischarge}
            onChange={(e) => handleChange('minDischarge', parseInt(e.target.value) || 0)} className={inputCls} />
        </Field>
        <Field label="Макс. заряд" unit="%" icon={<ArrowUpToLine className="w-3.5 h-3.5 text-emerald-500" />}>
          <input type="number" min={settings.minDischarge + 5} max="100" value={settings.maxCharge}
            onChange={(e) => handleChange('maxCharge', parseInt(e.target.value) || 100)} className={inputCls} />
        </Field>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; unit: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, unit, icon, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-slate-500 flex items-center gap-1.5">
      {icon}
      {label}
    </label>
    <div className="relative">
      {children}
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">{unit}</span>
    </div>
  </div>
);
