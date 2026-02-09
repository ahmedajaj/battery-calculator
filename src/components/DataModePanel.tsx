import React, { useState } from 'react';
import { Wifi, WifiOff, Settings, RefreshCw, Radio, ChevronDown, Users, BatteryCharging, Plug } from 'lucide-react';
import type { DataMode, BatteryMode, YasnoSlot, YasnoGroupData } from '../types';

interface Props {
  /* Battery source */
  batteryMode: BatteryMode;
  onBatteryModeChange: (mode: BatteryMode) => void;
  batterySOC: number | null;
  batteryLoading: boolean;
  batteryError: string | null;
  batteryLastUpdated: Date | null;
  onBatteryRefetch: () => void;
  batteryTokenConfigured: boolean;

  /* Power schedule source */
  scheduleMode: DataMode;
  onScheduleModeChange: (mode: DataMode) => void;
  group: number;
  onGroupChange: (group: number) => void;
  groupData: YasnoGroupData | null;
  availableGroups: number[];
  scheduleLoading: boolean;
  scheduleError: string | null;
  scheduleLastUpdated: Date | null;
  onScheduleRefetch: () => void;
}

/* ── Helpers ── */

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${String(min).padStart(2, '0')}`;
};

const fmtTime = (d: Date | null) =>
  d ? d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

/* Mini bar visualising one day of Yasno slots */
const ScheduleBar: React.FC<{ slots: YasnoSlot[]; label: string }> = ({ slots, label }) => {
  if (!slots || slots.length === 0) {
    return (
      <div className="space-y-1">
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="h-5 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
          Немає даних
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="flex h-5 rounded-lg overflow-hidden border border-slate-200">
        {slots.map((slot, i) => {
          const widthPct = ((slot.end - slot.start) / 1440) * 100;
          const isOutage = slot.type === 'Definite';
          return (
            <div
              key={i}
              style={{ width: `${widthPct}%`, minWidth: '2px' }}
              className={isOutage ? 'bg-red-300/80' : 'bg-emerald-300/80'}
              title={`${fmtMin(slot.start)} — ${fmtMin(slot.end)} · ${isOutage ? 'Відключення' : 'Електрика є'}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
};

/* ── Main component ── */

export const DataModePanel: React.FC<Props> = ({
  batteryMode,
  onBatteryModeChange,
  batterySOC,
  batteryLoading,
  batteryError,
  batteryLastUpdated,
  onBatteryRefetch,
  batteryTokenConfigured,
  scheduleMode,
  onScheduleModeChange,
  group,
  onGroupChange,
  groupData,
  availableGroups,
  scheduleLoading,
  scheduleError,
  scheduleLastUpdated,
  onScheduleRefetch,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isDeye = batteryMode === 'deye';
  const isYasno = scheduleMode === 'yasno';

  const deyeConnected = isDeye && !batteryError && batterySOC !== null;
  const yasnoConnected = isYasno && !scheduleError && groupData !== null;

  const anyLive = deyeConnected || yasnoConnected;
  const anyError = (isDeye && batteryError) || (isYasno && scheduleError);

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  /* Header summary text */
  const headerTitle = (() => {
    const parts: string[] = [];
    if (isDeye) parts.push('Deye');
    if (isYasno) parts.push(`Yasno · Гр.${group}`);
    if (parts.length === 0) return 'Ручний режим';
    return parts.join(' + ');
  })();

  const headerSubtitle = (() => {
    if (!isDeye && !isYasno) return 'Усі дані вводяться вручну';
    const parts: string[] = [];
    if (deyeConnected && batterySOC !== null) parts.push(`🔋 ${batterySOC}%`);
    if (yasnoConnected) parts.push(`Оновлено: ${fmtTime(scheduleLastUpdated)}`);
    if (isDeye && batteryError) parts.push('⚠️ Deye');
    if (isYasno && scheduleError) parts.push('⚠️ Yasno');
    return parts.join(' · ') || 'Підключення...';
  })();

  return (
    <div
      className={`rounded-2xl border shadow-sm transition-colors ${
        anyLive
          ? 'bg-emerald-50/50 border-emerald-200'
          : anyError
            ? 'bg-red-50/50 border-red-200'
            : 'bg-white border-slate-200'
      }`}
    >
      {/* ── Compact header ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 sm:p-5"
      >
        <div
          className={`p-2 rounded-xl ${
            anyLive
              ? 'bg-emerald-100'
              : anyError
                ? 'bg-red-100'
                : 'bg-slate-100'
          }`}
        >
          {anyLive ? (
            <Wifi className="w-4 h-4 text-emerald-600" />
          ) : anyError ? (
            <WifiOff className="w-4 h-4 text-red-500" />
          ) : (
            <Settings className="w-4 h-4 text-slate-500" />
          )}
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
            {headerTitle}
            {anyLive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                LIVE
              </span>
            )}
            {anyError && !anyLive && (
              <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                ПОМИЛКА
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 truncate">{headerSubtitle}</div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-5 border-t border-slate-200/50 pt-4">

          {/* ────── SECTION 1: Battery source ────── */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <BatteryCharging className="w-3.5 h-3.5" />
              Заряд батареї
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onBatteryModeChange('deye')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  isDeye
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                ☀️ Deye API
              </button>
              <button
                onClick={() => onBatteryModeChange('manual')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  !isDeye
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                ✋ Ручний
              </button>
            </div>

            {/* Deye status */}
            {isDeye && (
              <div className="space-y-2">
                {!batteryTokenConfigured && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    ⚠️ Токен не налаштовано. Додайте <code className="bg-amber-100 px-1 rounded text-xs">VITE_DEYE_TOKEN</code> до файлу <code className="bg-amber-100 px-1 rounded text-xs">.env</code>
                  </div>
                )}

                {batteryTokenConfigured && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      {deyeConnected && batterySOC !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-800">{batterySOC}%</span>
                          <span className="text-xs text-slate-400">SOC</span>
                          {batteryLastUpdated && (
                            <span className="text-[10px] text-slate-400 ml-auto">
                              {fmtTime(batteryLastUpdated)}
                            </span>
                          )}
                        </div>
                      ) : batteryLoading ? (
                        <span className="text-sm text-slate-400">Завантаження...</span>
                      ) : null}
                    </div>

                    <button
                      onClick={onBatteryRefetch}
                      disabled={batteryLoading}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                      title="Оновити зараз"
                    >
                      <RefreshCw className={`w-4 h-4 ${batteryLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}

                {batteryError && batteryTokenConfigured && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                    ⚠️ {batteryError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200/70" />

          {/* ────── SECTION 2: Power schedule source ────── */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Plug className="w-3.5 h-3.5" />
              Графік електрики
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onScheduleModeChange('yasno')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  isYasno
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                ⚡ Yasno
              </button>
              <button
                onClick={() => onScheduleModeChange('manual')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  !isYasno
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                ✋ Ручний
              </button>
            </div>

            {/* Yasno settings */}
            {isYasno && (
              <>
                {/* Group selector + refresh */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600 font-medium whitespace-nowrap flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Група
                  </label>
                  {availableGroups.length > 0 ? (
                    <select
                      value={group}
                      onChange={(e) => onGroupChange(parseInt(e.target.value, 10))}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
                    >
                      {availableGroups.map((g) => (
                        <option key={g} value={g}>
                          {g}.1
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={group}
                      onChange={(e) => onGroupChange(parseInt(e.target.value, 10) || 1)}
                      className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
                    />
                  )}
                  <button
                    onClick={onScheduleRefetch}
                    disabled={scheduleLoading}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    title="Оновити зараз"
                  >
                    <RefreshCw className={`w-4 h-4 ${scheduleLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Error message */}
                {scheduleError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                    ⚠️ {scheduleError}
                  </div>
                )}

                {/* Schedule bars */}
                {groupData && (
                  <div className="space-y-3">
                    <ScheduleBar
                      slots={groupData.today.slots}
                      label={`Сьогодні${groupData.today.date ? ' · ' + fmtDate(groupData.today.date) : ''}`}
                    />
                    <ScheduleBar
                      slots={groupData.tomorrow.slots}
                      label={`Завтра${groupData.tomorrow.date ? ' · ' + fmtDate(groupData.tomorrow.date) : ''}`}
                    />

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-2.5 rounded-sm bg-emerald-300/80 border border-emerald-400/30" />
                        Електрика є
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-2.5 rounded-sm bg-red-300/80 border border-red-400/30" />
                        Відключення
                      </span>
                    </div>
                  </div>
                )}

                {/* Group not found */}
                {!groupData && !scheduleError && !scheduleLoading && (
                  <div className="text-sm text-slate-400 text-center py-2">
                    Група {group}.1 не знайдена в даних API
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
