import React from 'react';
import { Battery, Zap, Settings } from 'lucide-react';
import type { BatterySettings } from '../types';

interface Props {
  settings: BatterySettings;
  onChange: (settings: BatterySettings) => void;
}

const inputClassName = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";

export const BatterySettingsPanel: React.FC<Props> = ({ settings, onChange }) => {
  const handleChange = (key: keyof BatterySettings, value: number) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-50 rounded-xl">
          <Battery className="w-5 h-5 text-blue-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Налаштування батареї</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Capacity */}
        <div className="space-y-2">
          <label className="text-sm text-slate-600 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            Ємність батареї
          </label>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="100"
              step="0.5"
              value={settings.capacity}
              onChange={(e) => handleChange('capacity', parseFloat(e.target.value) || 1)}
              className={inputClassName}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">кВт·год</span>
          </div>
        </div>

        {/* Current Charge */}
        <div className="space-y-2">
          <label className="text-sm text-slate-600 flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-400" />
            Поточний заряд
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              value={settings.currentCharge}
              onChange={(e) => handleChange('currentCharge', parseInt(e.target.value) || 0)}
              className={inputClassName}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>

        {/* Min Discharge */}
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Мін. розряд</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max={settings.maxCharge - 5}
              value={settings.minDischarge}
              onChange={(e) => handleChange('minDischarge', parseInt(e.target.value) || 0)}
              className={inputClassName}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>

        {/* Max Charge */}
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Макс. заряд</label>
          <div className="relative">
            <input
              type="number"
              min={settings.minDischarge + 5}
              max="100"
              value={settings.maxCharge}
              onChange={(e) => handleChange('maxCharge', parseInt(e.target.value) || 100)}
              className={inputClassName}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>

        {/* Charging Power */}
        <div className="space-y-2 col-span-2">
          <label className="text-sm text-slate-600">Потужність зарядки</label>
          <div className="relative">
            <input
              type="number"
              min="0.5"
              max="20"
              step="0.5"
              value={settings.chargingPower}
              onChange={(e) => handleChange('chargingPower', parseFloat(e.target.value) || 0.5)}
              className={inputClassName}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">кВт</span>
          </div>
        </div>
      </div>
    </div>
  );
};
