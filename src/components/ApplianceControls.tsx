import React from 'react';
import { Droplets, Flame, Building2, Lightbulb, Power } from 'lucide-react';
import type { Appliance } from '../types';

interface Props {
  appliances: Appliance[];
  onChange: (appliances: Appliance[]) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  water: <Droplets className="w-4 h-4" />,
  heating: <Flame className="w-4 h-4" />,
  elevator: <Building2 className="w-4 h-4" />,
  lighting: <Lightbulb className="w-4 h-4" />,
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
    <div className="card">
      <div className="card-head">
        <div className="card-icon"><Power /></div>
        <div className="flex-1">
          <h2 className="card-title">Прилади</h2>
          <p className="card-sub">Увімкніть потрібні та вкажіть потужність</p>
        </div>
        <div className="text-right inset px-3 py-1.5">
          <div className="text-[11px] font-medium text-slate-600">Загалом</div>
          <div className="text-base font-bold tracking-tight text-slate-900">{totalPower.toFixed(1)} кВт</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {appliances.map((appliance) => (
          <div
            key={appliance.id}
            className={`rounded-xl p-3 flex flex-col gap-3 transition-all duration-200 ${
              appliance.enabled
                ? 'bg-white ring-1 ring-slate-200 shadow-sm'
                : 'bg-slate-50 ring-1 ring-inset ring-slate-200 border-dashed'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="grid place-items-center w-8 h-8 rounded-lg shrink-0 transition-colors"
                style={{
                  backgroundColor: appliance.enabled ? `${appliance.color}1f` : 'var(--color-slate-200)',
                  color: appliance.enabled ? appliance.color : 'var(--color-slate-500)',
                }}
              >
                {iconMap[appliance.id]}
              </div>
              <h3 className={`flex-1 min-w-0 text-sm font-semibold leading-tight truncate ${appliance.enabled ? 'text-slate-900' : 'text-slate-500'}`}>
                {appliance.nameUa}
              </h3>
              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={appliance.enabled}
                aria-label={appliance.enabled ? `Вимкнути: ${appliance.nameUa}` : `Увімкнути: ${appliance.nameUa}`}
                onClick={() => handleToggle(appliance.id)}
                className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${appliance.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${appliance.enabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>

            <div className="relative">
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
                className="input h-9 pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 pointer-events-none">кВт</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
