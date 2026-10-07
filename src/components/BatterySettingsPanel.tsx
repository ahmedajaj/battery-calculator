import React from 'react';
import { Battery, Zap, BatteryCharging, ArrowDownToLine, ArrowUpToLine, Radio } from 'lucide-react';
import type { BatterySettings, ApiLockedFields } from '../types';

interface Props {
  settings: BatterySettings;
  onChange: (settings: BatterySettings) => void;
  lockedFields?: ApiLockedFields;
}

export const BatterySettingsPanel: React.FC<Props> = ({ settings, onChange, lockedFields }) => {
  const handleChange = (key: keyof BatterySettings, value: number) => {
    onChange({ ...settings, [key]: value });
  };

  const chargeLocked = lockedFields?.currentCharge ?? false;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-icon"><Battery /></div>
        <div>
          <h2 className="card-title">Налаштування батареї</h2>
          <p className="card-sub">Ємність, ліміти заряду та потужність зарядки</p>
        </div>
      </div>

      {/* Current Charge — highlighted, always on top */}
      <div className={`rounded-xl p-3.5 mb-5 flex items-center gap-3 ring-1 ring-inset ${
        chargeLocked ? 'bg-emerald-50 ring-emerald-300' : 'bg-amber-50 ring-amber-300'
      }`}>
        {chargeLocked ? (
          <Radio className="w-4 h-4 text-emerald-800 animate-pulse shrink-0" />
        ) : (
          <Zap className="w-4 h-4 text-amber-800 shrink-0" />
        )}
        <label className={`text-sm font-semibold whitespace-nowrap ${chargeLocked ? 'text-emerald-900' : 'text-amber-900'}`}>
          Поточний заряд
        </label>
        <div className="relative flex-1 max-w-[128px]">
          {chargeLocked ? (
            <div className="h-10 grid place-items-center bg-white ring-1 ring-emerald-300 rounded-lg text-emerald-900 font-mono font-bold text-base">
              {settings.currentCharge}%
            </div>
          ) : (
            <>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.currentCharge || ''}
                placeholder="—"
                onChange={(e) => handleChange('currentCharge', parseInt(e.target.value) || 0)}
                className="input !text-base !font-bold !border-amber-400 focus:!border-amber-600 focus:!ring-amber-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-800 text-xs font-semibold pointer-events-none">%</span>
            </>
          )}
        </div>
        {chargeLocked ? (
          <span className="chip chip-live hidden sm:inline-flex ml-auto">
            <Radio className="w-3 h-3" />LIVE
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-800 hidden sm:inline ml-auto">⟵ вкажіть щоразу</span>
        )}
      </div>

      {/* Config fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Field label="Ємність" unit="кВт·год" icon={<Battery className="w-3.5 h-3.5 text-sky-600" />}>
          <input type="number" min="1" max="500" step="0.5" value={settings.capacity}
            onChange={(e) => handleChange('capacity', parseFloat(e.target.value) || 1)} className="input pr-16" />
        </Field>
        <Field label="Зарядка" unit="кВт" icon={<BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />}>
          <input type="number" min="0.5" max="100" step="0.5" value={settings.chargingPower}
            onChange={(e) => handleChange('chargingPower', parseFloat(e.target.value) || 0.5)} className="input pr-10" />
        </Field>
        <Field label="Мін. розряд" unit="%" icon={<ArrowDownToLine className="w-3.5 h-3.5 text-rose-600" />}>
          <input type="number" min="0" max={settings.maxCharge - 5} value={settings.minDischarge}
            onChange={(e) => handleChange('minDischarge', parseInt(e.target.value) || 0)} className="input pr-8" />
        </Field>
        <Field label="Макс. заряд" unit="%" icon={<ArrowUpToLine className="w-3.5 h-3.5 text-emerald-600" />}>
          <input type="number" min={settings.minDischarge + 5} max="100" value={settings.maxCharge}
            onChange={(e) => handleChange('maxCharge', parseInt(e.target.value) || 100)} className="input pr-8" />
        </Field>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; unit: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, unit, icon, children }) => (
  <div className="space-y-1.5">
    <label className="field-label">
      {icon}
      {label}
    </label>
    <div className="relative">
      {children}
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium pointer-events-none">{unit}</span>
    </div>
  </div>
);
