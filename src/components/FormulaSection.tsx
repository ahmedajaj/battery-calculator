import React from 'react';
import { Calculator, ChevronDown } from 'lucide-react';
import type { CalculationResult, BatterySettings } from '../types';

interface Props {
  result: CalculationResult;
  battery: BatterySettings;
}

interface FormulaItem {
  title: string;
  icon: string;
  formula: string;
  substitution: string;
  value: string;
  note: string;
}

export const FormulaSection: React.FC<Props> = ({ result, battery }) => {
  const usableRange = battery.maxCharge - battery.minDischarge;
  const totalUsableEnergy = (battery.capacity * usableRange) / 100;
  const energyToFull = (battery.capacity * (battery.maxCharge - battery.currentCharge)) / 100;
  const chargeRatePercent = (battery.chargingPower / battery.capacity) * 100;
  const dischargeRatePercent = (result.currentConsumption / battery.capacity) * 100;

  const formulas: FormulaItem[] = [
    {
      title: 'Загальна доступна ємність',
      icon: '🔋',
      formula: 'E_total = C × (SoC_max − SoC_min) ÷ 100',
      substitution: `E = ${battery.capacity} × (${battery.maxCharge} − ${battery.minDischarge}) ÷ 100`,
      value: `${totalUsableEnergy.toFixed(1)} кВт·год`,
      note: 'Максимальна кількість енергії між мін. і макс. рівнем заряду',
    },
    {
      title: 'Поточна доступна енергія',
      icon: '⚡',
      formula: 'E_avail = C × (SoC − SoC_min) ÷ 100',
      substitution: `E = ${battery.capacity} × (${battery.currentCharge} − ${battery.minDischarge}) ÷ 100`,
      value: `${result.currentAvailableEnergy.toFixed(1)} кВт·год`,
      note: 'Енергія, доступна від поточного заряду до мінімального рівня',
    },
    {
      title: 'Поточне споживання з батареї',
      icon: '📊',
      formula: 'P_bat = 0 якщо електрика є, інакше Σ P_i',
      substitution: result.currentConsumption > 0
        ? `P = сума потужностей активних приладів (електрики немає)`
        : 'P = 0 (електрика є — прилади працюють від мережі)',
      value: `${result.currentConsumption.toFixed(1)} кВт`,
      note: 'Коли електрика є, прилади живляться від мережі — батарея не витрачається. Споживання з батареї тільки при відсутності електрики.',
    },
    {
      title: 'Час автономної роботи',
      icon: '⏱️',
      formula: 'T_run = E_avail ÷ P',
      substitution: result.currentConsumption > 0
        ? `T = ${result.currentAvailableEnergy.toFixed(1)} ÷ ${result.currentConsumption.toFixed(1)}`
        : 'T = ∞ (споживання = 0)',
      value: result.currentConsumption > 0
        ? `${result.hoursRemaining.toFixed(1)} год`
        : '∞',
      note: 'Оцінка часу за поточного рівня споживання (спрощена, без зміни розкладу)',
    },
    {
      title: 'Час до повної зарядки (ідеальний)',
      icon: '🔌',
      formula: 'T_charge = (C × (SoC_max − SoC) ÷ 100) ÷ P_charger',
      substitution: `T = (${battery.capacity} × (${battery.maxCharge} − ${battery.currentCharge}) ÷ 100) ÷ ${battery.chargingPower}`,
      value: battery.chargingPower > 0
        ? `${energyToFull.toFixed(1)} ÷ ${battery.chargingPower} = ${(energyToFull / battery.chargingPower).toFixed(2)} год`
        : '∞ (немає зарядки)',
      note: 'Ідеальний час зарядки без урахування одночасного споживання приладів',
    },
    {
      title: 'Зміна заряду за годину (з електрикою)',
      icon: '📈',
      formula: 'ΔSoC = P_charger ÷ C × 100  [% / год]',
      substitution: `ΔSoC = ${battery.chargingPower} ÷ ${battery.capacity} × 100`,
      value: `+${chargeRatePercent.toFixed(1)}% за годину`,
      note: 'Батарея заряджається на повну потужність — прилади працюють від мережі і не впливають на швидкість зарядки',
    },
    {
      title: 'Швидкість розряду (без електрики)',
      icon: '📉',
      formula: 'ΔSoC = −P ÷ C × 100  [% / год]',
      substitution: `ΔSoC = −${result.currentConsumption.toFixed(1)} ÷ ${battery.capacity} × 100`,
      value: result.currentConsumption > 0
        ? `−${dischargeRatePercent.toFixed(1)}% за годину`
        : '0% (немає споживання)',
      note: 'Швидкість розрядки батареї при відсутності електропостачання',
    },
  ];

  return (
    <details className="bg-white rounded-2xl border border-slate-200 shadow-sm group">
      <summary className="cursor-pointer p-6 md:p-8 flex items-center gap-3 list-none [&::-webkit-details-marker]:hidden">
        <div className="p-2.5 bg-indigo-50 rounded-xl">
          <Calculator className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-800">Формули розрахунків</h2>
          <p className="text-sm text-slate-500">Детальний опис формул та підставлені значення</p>
        </div>
        <ChevronDown className="w-5 h-5 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="px-6 md:px-8 pb-6 md:pb-8 space-y-4 border-t border-slate-100 pt-6">
        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div><span className="font-mono font-semibold text-slate-700">C</span> — ємність ({battery.capacity} кВт·год)</div>
          <div><span className="font-mono font-semibold text-slate-700">SoC</span> — рівень заряду ({battery.currentCharge}%)</div>
          <div><span className="font-mono font-semibold text-slate-700">P</span> — споживання ({result.currentConsumption.toFixed(1)} кВт)</div>
          <div><span className="font-mono font-semibold text-slate-700">P_charger</span> — зарядка ({battery.chargingPower} кВт)</div>
        </div>

        {/* Formula cards */}
        {formulas.map((f, i) => (
          <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{f.icon}</span>
              <h3 className="font-semibold text-slate-800 text-sm">{f.title}</h3>
            </div>

            {/* Generic formula */}
            <div className="font-mono text-sm text-indigo-700 bg-indigo-50 rounded-lg px-3 py-1.5 border border-indigo-100">
              {f.formula}
            </div>

            {/* Substituted values */}
            <div className="font-mono text-sm text-slate-600 bg-white rounded-lg px-3 py-1.5 border border-slate-200">
              {f.substitution}
            </div>

            {/* Result */}
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-800 text-base bg-green-50 rounded-lg px-3 py-1 border border-green-200">
                = {f.value}
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-400 leading-relaxed">{f.note}</p>
          </div>
        ))}

        <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
          💡 Значення оновлюються автоматично при зміні параметрів
        </div>
      </div>
    </details>
  );
};
