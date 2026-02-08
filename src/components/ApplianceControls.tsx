import React from 'react';
import { Droplets, Flame, Building2, Lightbulb, Power, PowerOff } from 'lucide-react';
import type { Appliance } from '../types';

interface Props {
  appliances: Appliance[];
  onChange: (appliances: Appliance[]) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  water: <Droplets className="w-5 h-5" />,
  heating: <Flame className="w-5 h-5" />,
  elevator: <Building2 className="w-5 h-5" />,
  lighting: <Lightbulb className="w-5 h-5" />,
};

export const ApplianceControls: React.FC<Props> = ({ appliances, onChange }) => {
  const handleToggle = (id: string) => {
    onChange(
      appliances.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      )
    );
  };

  const handlePowerChange = (id: string, power: number) => {
    onChange(
      appliances.map((a) =>
        a.id === id ? { ...a, power: Math.max(0.1, power) } : a
      )
    );
  };

  const totalPower = appliances
    .filter((a) => a.enabled)
    .reduce((sum, a) => sum + a.power, 0);

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 rounded-xl">
            <Power className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Прилади</h2>
        </div>
        <div className="text-right bg-purple-50 px-4 py-2 rounded-xl">
          <div className="text-xs text-purple-600">Загальне споживання</div>
          <div className="text-xl font-bold text-purple-600">{totalPower.toFixed(1)} кВт</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {appliances.map((appliance) => (
          <div
            key={appliance.id}
            className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
              appliance.enabled
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-slate-50/50 border-slate-100'
            }`}
          >
            {/* Color indicator - always visible */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5"
              style={{
                backgroundColor: appliance.enabled ? appliance.color : `${appliance.color}80`,
              }}
            />

            <div className="p-5 pl-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggle(appliance.id)}
                    className={`p-2.5 rounded-xl transition-all duration-300 ${
                      appliance.enabled
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {appliance.enabled ? (
                      <Power className="w-5 h-5" />
                    ) : (
                      <PowerOff className="w-5 h-5" />
                    )}
                  </button>

                  <div
                    className={`p-2 rounded-lg transition-all duration-300 ${
                      appliance.enabled ? 'bg-slate-100' : 'bg-slate-50'
                    }`}
                    style={{ color: appliance.enabled ? appliance.color : '#94a3b8' }}
                  >
                    {iconMap[appliance.id]}
                  </div>

                  <div>
                    <h3
                      className={`font-medium transition-colors duration-300 ${
                        appliance.enabled ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {appliance.nameUa}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={appliance.power}
                    onChange={(e) =>
                      handlePowerChange(appliance.id, parseFloat(e.target.value) || 0.1)
                    }
                    disabled={!appliance.enabled}
                    className={`w-20 text-right bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      appliance.enabled
                        ? 'text-slate-800'
                        : 'text-slate-400 opacity-50 cursor-not-allowed'
                    }`}
                  />
                  <span className="text-sm text-slate-400 w-8">кВт</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
