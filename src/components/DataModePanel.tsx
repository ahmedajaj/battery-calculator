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
  /** DTEK suspended the hourly schedule (e.g. emergency outages) */
  scheduleSuspended?: boolean;
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
        <div className="text-xs text-slate-700 font-medium">{label}</div>
        <div className="h-6 rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200 flex items-center justify-center text-[11px] text-slate-600">
          Немає даних
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-700 font-medium">{label}</div>
      <div className="flex h-6 rounded-lg overflow-hidden ring-1 ring-inset ring-slate-200 gap-px bg-white">
        {slots.map((slot, i) => {
          const widthPct = ((slot.end - slot.start) / 1440) * 100;
          const isOutage = slot.type === 'Definite';
          return (
            <div
              key={i}
              style={{ width: `${widthPct}%`, minWidth: '2px' }}
              className={isOutage ? 'bg-rose-500' : 'bg-emerald-500'}
              title={`${fmtMin(slot.start)} — ${fmtMin(slot.end)} · ${isOutage ? 'Відключення' : 'Електрика є'}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
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
  scheduleSuspended = false,
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
    if (isYasno) parts.push(`ДТЕК · Гр.${group}`);
    if (parts.length === 0) return 'Ручний режим';
    return parts.join(' + ');
  })();

  const headerSubtitle = (() => {
    if (!isDeye && !isYasno) return 'Усі дані вводяться вручну';
    const parts: string[] = [];
    if (deyeConnected && batterySOC !== null) parts.push(`🔋 ${batterySOC}%`);
    if (yasnoConnected && scheduleSuspended) parts.push('⚠️ ДТЕК: екстрені відключення');
    else if (yasnoConnected) parts.push(`Оновлено: ${fmtTime(scheduleLastUpdated)}`);
    if (isDeye && batteryError) parts.push('⚠️ Deye');
    if (isYasno && scheduleError) parts.push('⚠️ ДТЕК');
    return parts.join(' · ') || 'Підключення...';
  })();

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm transition-colors ${
        anyError && !anyLive ? 'border-rose-300' : 'border-slate-200'
      }`}
    >
      {/* ── Compact header ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 sm:px-6 sm:py-5"
        aria-expanded={expanded}
      >
        <div className={`card-icon ${anyLive ? '!bg-emerald-600' : anyError ? '!bg-rose-600' : ''}`}>
          {anyLive ? <Wifi /> : anyError ? <WifiOff /> : <Settings />}
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="card-title flex items-center gap-2 flex-wrap">
            {headerTitle}
            {anyLive && (
              <span className="chip chip-live">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </span>
            )}
            {anyError && !anyLive && (
              <span className="chip chip-error">
                ПОМИЛКА
              </span>
            )}
          </div>
          <div className="card-sub truncate">{headerSubtitle}</div>
        </div>

        <ChevronDown
          className={`w-5 h-5 text-slate-600 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="px-4 sm:px-6 pb-5 sm:pb-6 space-y-5 border-t border-slate-200 pt-5">

          {/* ────── SECTION 1: Battery source ────── */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BatteryCharging className="w-3.5 h-3.5" />
              Заряд батареї
            </div>

            {/* Mode toggle */}
            <div className="seg">
              <button
                aria-pressed={isDeye}
                onClick={() => onBatteryModeChange('deye')}
                className="seg-btn"
              >
                ☀️ Deye API
              </button>
              <button
                aria-pressed={!isDeye}
                onClick={() => onBatteryModeChange('manual')}
                className="seg-btn"
              >
                ✋ Ручний
              </button>
            </div>

            {/* Deye status */}
            {isDeye && (
              <div className="space-y-2">
                {!batteryTokenConfigured && (
                  <div className="alert alert-warn">
                    ⚠️ Токен не налаштовано. Додайте <code className="bg-amber-100 px-1 rounded text-xs">DEYE_TOKEN</code> до файлу <code className="bg-amber-100 px-1 rounded text-xs">.env</code>
                  </div>
                )}

                {batteryTokenConfigured && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      {deyeConnected && batterySOC !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold tracking-tight text-slate-900">{batterySOC}%</span>
                          <span className="text-xs font-medium text-slate-600">SOC</span>
                          {batteryLastUpdated && (
                            <span className="text-xs text-slate-600 ml-auto font-mono">
                              {fmtTime(batteryLastUpdated)}
                            </span>
                          )}
                        </div>
                      ) : batteryLoading ? (
                        <span className="text-sm text-slate-600">Завантаження...</span>
                      ) : null}
                    </div>

                    <button
                      onClick={onBatteryRefetch}
                      disabled={batteryLoading}
                      className="btn btn-primary w-10 px-0"
                      title="Оновити зараз"
                    >
                      <RefreshCw className={`w-4 h-4 ${batteryLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}

                {batteryError && batteryTokenConfigured && (
                  <div className="alert alert-error">
                    ⚠️ {batteryError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200" />

          {/* ────── SECTION 2: Power schedule source ────── */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plug className="w-3.5 h-3.5" />
              Графік електрики
            </div>

            {/* Mode toggle */}
            <div className="seg">
              <button
                aria-pressed={isYasno}
                onClick={() => onScheduleModeChange('yasno')}
                className="seg-btn"
              >
                ⚡ ДТЕК
              </button>
              <button
                aria-pressed={!isYasno}
                onClick={() => onScheduleModeChange('manual')}
                className="seg-btn"
              >
                ✋ Ручний
              </button>
            </div>

            {/* Yasno settings */}
            {isYasno && (
              <>
                {/* Group selector + refresh */}
                <div className="flex items-center gap-3">
                  <label className="field-label text-sm whitespace-nowrap">
                    <Users className="w-3.5 h-3.5" />
                    Група
                  </label>
                  {availableGroups.length > 0 ? (
                    <select
                      value={group}
                      onChange={(e) => onGroupChange(parseInt(e.target.value, 10))}
                      className="input flex-1 w-auto"
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
                      className="input w-20"
                    />
                  )}
                  <button
                    onClick={onScheduleRefetch}
                    disabled={scheduleLoading}
                    className="btn btn-primary w-10 px-0"
                    title="Оновити зараз"
                  >
                    <RefreshCw className={`w-4 h-4 ${scheduleLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Error message */}
                {scheduleError && (
                  <div className="alert alert-error">
                    ⚠️ {scheduleError}
                  </div>
                )}

                {scheduleSuspended && (
                  <div className="alert alert-warn">
                    <b className="font-semibold">Діють екстрені відключення.</b> ДТЕК не застосовує погодинний графік,
                    тому прогноз розраховано за найгіршим сценарієм — ніби світла не буде весь час.
                  </div>
                )}

                {/* Schedule bars */}
                {groupData && !scheduleSuspended && (
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
                    <div className="flex items-center gap-4 text-xs text-slate-700">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                        Електрика є
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-rose-500" />
                        Відключення
                      </span>
                    </div>
                  </div>
                )}

                {/* Group not found */}
                {!groupData && !scheduleError && !scheduleLoading && (
                  <div className="text-sm text-slate-600 text-center py-2">
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
