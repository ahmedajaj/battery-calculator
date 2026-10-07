import React, { useState, useCallback } from 'react';
import { Calendar, GripHorizontal, Zap } from 'lucide-react';
import type { Appliance, TimeRange, PowerSchedule } from '../types';

// Extract clientX from mouse or touch event
const getClientX = (e: React.MouseEvent | React.TouchEvent): number => {
  if ('touches' in e) {
    return e.touches[0]?.clientX ?? (e as React.TouchEvent).changedTouches[0]?.clientX ?? 0;
  }
  return (e as React.MouseEvent).clientX;
};

interface Props {
  appliances: Appliance[];
  onChange: (appliances: Appliance[]) => void;
  powerSchedule: PowerSchedule;
  onPowerScheduleChange: (schedule: PowerSchedule) => void;
  currentHour: number;
  powerScheduleLocked?: boolean;
  tomorrowHasData?: boolean;
}

export const TimelineScheduler: React.FC<Props> = ({ appliances, onChange, powerSchedule, onPowerScheduleChange, currentHour, powerScheduleLocked = false, tomorrowHasData = true }) => {
  const [dragging, setDragging] = useState<{
    targetType: 'appliance' | 'power';
    targetId: string;
    rangeIndex: number;
    type: 'move' | 'start' | 'end';
    startX: number;
    originalRange: TimeRange;
  } | null>(null);

  // ── Shifted view (starts from current hour, like the chart) ──
  const startHour = Math.floor(currentHour);
  const hours = Array.from({ length: 24 }, (_, i) => (startHour + i) % 24);

  /** Absolute hour (0-24) → visual position (0-24 offset from startHour) */
  const toVisual = (absHour: number): number => {
    let v = absHour - startHour;
    if (v < 0) v += 24;
    return v;
  };

  /** Visual position → absolute hour */
  const toAbsolute = (vis: number): number => (vis + startHour) % 24;

  /** Split an absolute-hour range into 1-2 visual segments (handles wrap) */
  const getVisualSegments = (range: TimeRange): { start: number; end: number }[] => {
    const vs = toVisual(range.start);
    const ve = toVisual(range.end);
    if (ve > vs) return [{ start: vs, end: ve }];
    // end maps to 0 → treat as right edge (24)
    if (ve === 0 && vs < 24) return [{ start: vs, end: 24 }];
    const segs: { start: number; end: number }[] = [];
    if (vs < 24) segs.push({ start: vs, end: 24 });
    if (ve > 0) segs.push({ start: 0, end: ve });
    return segs;
  };

  const nowVisual = currentHour - startHour;
  const midnightVisual = startHour > 0 ? 24 - startHour : 0;

  const handleAddRange = (applianceId: string, clickHour: number) => {
    const hour = Math.floor(clickHour * 2) / 2; // snap to 30 min
    onChange(
      appliances.map((a) => {
        if (a.id === applianceId) {
          // Check if clicking on existing range
          const existingRange = a.schedule.find(
            (r) => hour >= r.start && hour < r.end
          );
          if (existingRange) return a;

          const newRange: TimeRange = {
            start: hour,
            end: Math.min(hour + 4, 24),
          };
          return { ...a, schedule: [...a.schedule, newRange] };
        }
        return a;
      })
    );
  };

  const handleRemoveRange = (applianceId: string, rangeIndex: number) => {
    onChange(
      appliances.map((a) => {
        if (a.id === applianceId) {
          return {
            ...a,
            schedule: a.schedule.filter((_, i) => i !== rangeIndex),
          };
        }
        return a;
      })
    );
  };

  const handleAddPowerPeriod = (clickHour: number) => {
    const hour = Math.floor(clickHour * 2) / 2; // snap to 30 min
    const existingPeriod = powerSchedule.periods.find(
      (p) => hour >= p.start && hour < p.end
    );
    if (existingPeriod) return;
    const newPeriod: TimeRange = {
      start: hour,
      end: Math.min(hour + 4, 24),
    };
    onPowerScheduleChange({ periods: [...powerSchedule.periods, newPeriod] });
  };

  const handleRemovePowerPeriod = (index: number) => {
    onPowerScheduleChange({
      periods: powerSchedule.periods.filter((_, i) => i !== index),
    });
  };

  const handlePointerDown = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent,
      targetType: 'appliance' | 'power',
      targetId: string,
      rangeIndex: number,
      type: 'move' | 'start' | 'end'
    ) => {
      e.preventDefault();
      e.stopPropagation();

      let originalRange: TimeRange;
      if (targetType === 'power') {
        originalRange = { ...powerSchedule.periods[rangeIndex] };
      } else {
        const appliance = appliances.find((a) => a.id === targetId);
        if (!appliance) return;
        originalRange = { ...appliance.schedule[rangeIndex] };
      }

      setDragging({
        targetType,
        targetId,
        rangeIndex,
        type,
        startX: getClientX(e),
        originalRange,
      });
    },
    [appliances, powerSchedule]
  );

  const SNAP = 0.5; // 30-minute granularity

  const snapTo = (val: number) => Math.round(val / SNAP) * SNAP;

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent, containerWidth: number) => {
      if (!dragging) return;
      if ('touches' in e) e.preventDefault(); // prevent scroll while dragging

      const deltaX = getClientX(e) - dragging.startX;
      const rawDelta = (deltaX / containerWidth) * 24;
      const deltaHours = Math.round(rawDelta / SNAP) * SNAP;

      const range = { ...dragging.originalRange };

      if (dragging.type === 'move') {
        const duration = range.end - range.start;
        range.start = snapTo(Math.max(0, Math.min(24 - duration, range.start + deltaHours)));
        range.end = range.start + duration;
      } else if (dragging.type === 'start') {
        range.start = snapTo(Math.max(0, Math.min(range.end - SNAP, range.start + deltaHours)));
      } else if (dragging.type === 'end') {
        range.end = snapTo(Math.max(range.start + SNAP, Math.min(24, range.end + deltaHours)));
      }

      if (dragging.targetType === 'power') {
        const newPeriods = [...powerSchedule.periods];
        newPeriods[dragging.rangeIndex] = range;
        onPowerScheduleChange({ periods: newPeriods });
      } else {
        onChange(
          appliances.map((a) => {
            if (a.id === dragging.targetId) {
              const newSchedule = [...a.schedule];
              newSchedule[dragging.rangeIndex] = range;
              return { ...a, schedule: newSchedule };
            }
            return a;
          })
        );
      }
    },
    [dragging, appliances, onChange, powerSchedule, onPowerScheduleChange]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // ── Segment renderer (handles visual wrapping) ──
  const renderSegments = (
    range: TimeRange,
    index: number,
    targetType: 'appliance' | 'power',
    targetId: string,
    color: string,
    bgColor: string,
    onRemove: () => void,
    locked = false,
  ) => {
    const segments = getVisualSegments(range).filter(s => s.end > s.start);
    return segments.map((seg, si) => {
      const isFirst = si === 0;
      const isLast = si === segments.length - 1;
      return (
        <div
          key={`${index}-${si}`}
          className={`absolute top-1.5 bottom-1.5 flex items-center justify-center group shadow-sm ${locked ? 'cursor-default' : 'cursor-move'}`}
          style={{
            left: `${(seg.start / 24) * 100}%`,
            width: `${((seg.end - seg.start) / 24) * 100}%`,
            backgroundColor: bgColor,
            border: `2px solid ${color}`,
            borderRadius: `${isFirst ? '8px' : '0'} ${isLast ? '8px' : '0'} ${isLast ? '8px' : '0'} ${isFirst ? '8px' : '0'}`,
          }}
          title={`${Math.floor(range.start)}:${range.start % 1 ? '30' : '00'}–${Math.floor(range.end)}:${range.end % 1 ? '30' : '00'}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={locked ? undefined : (e) => handlePointerDown(e, targetType, targetId, index, 'move')}
          onTouchStart={locked ? undefined : (e) => handlePointerDown(e, targetType, targetId, index, 'move')}
          onDoubleClick={locked ? undefined : onRemove}
        >
          {!locked && isFirst && (
            <div
              className="absolute left-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize hover:bg-black/10 active:bg-black/10 rounded-l"
              onMouseDown={(e) => handlePointerDown(e, targetType, targetId, index, 'start')}
              onTouchStart={(e) => handlePointerDown(e, targetType, targetId, index, 'start')}
            />
          )}
          {!locked && isLast && (
            <div
              className="absolute right-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize hover:bg-black/10 active:bg-black/10 rounded-r"
              onMouseDown={(e) => handlePointerDown(e, targetType, targetId, index, 'end')}
              onTouchStart={(e) => handlePointerDown(e, targetType, targetId, index, 'end')}
            />
          )}
          {isFirst && range.end - range.start >= 3 && (
            <span className="text-[11px] sm:text-xs font-semibold font-mono opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none" style={{ color, filter: 'brightness(0.7) saturate(1.2)' }}>
              {!locked && <GripHorizontal className="w-3 h-3 hidden sm:block" />}
              {Math.floor(range.start)}:{range.start % 1 ? '30' : '00'}-{Math.floor(range.end)}:{range.end % 1 ? '30' : '00'}
            </span>
          )}
          {!locked && isFirst && (
            <button
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-md sm:hidden z-10"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              onTouchStart={(e) => e.stopPropagation()}
            >×</button>
          )}
        </div>
      );
    });
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-icon"><Calendar /></div>
        <div>
          <h2 className="card-title">Розклад приладів</h2>
          <p className="card-sub">Починаючи з поточної години (як графік)</p>
        </div>
      </div>

      {/* Hour labels — shifted from now */}
      <div className="flex mb-2 sm:pl-[92px] md:pl-[124px]">
        {hours.map((hour, idx) => (
          <div
            key={idx}
            className="flex-1 text-center text-xs text-slate-600 font-mono font-medium"
            style={{ minWidth: 0 }}
          >
            {idx % 3 === 0 ? `${hour}` : ''}
          </div>
        ))}
      </div>

      {/* Timeline rows */}
      <div
        className="space-y-3"
        onMouseMove={(e) => {
          const container = e.currentTarget.querySelector('.timeline-container');
          if (container) {
            handlePointerMove(e, container.clientWidth);
          }
        }}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchMove={(e) => {
          const container = e.currentTarget.querySelector('.timeline-container');
          if (container) {
            handlePointerMove(e, container.clientWidth);
          }
        }}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      >
        {/* Power schedule bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="sm:w-20 md:w-28 flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm text-slate-900 truncate font-medium">Електрика</span>
            {powerScheduleLocked && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden sm:block" />}
          </div>
          <div
            className={`timeline-container flex-none sm:flex-1 h-12 bg-rose-50 rounded-xl relative overflow-hidden ring-1 ring-inset ring-rose-200 touch-action-none ${
              powerScheduleLocked ? 'cursor-default' : 'cursor-pointer'
            }`}
            style={{ touchAction: 'none' }}
            onClick={(e) => {
              if (powerScheduleLocked) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const visualHour = ((e.clientX - rect.left) / rect.width) * 24;
              handleAddPowerPeriod(toAbsolute(visualHour));
            }}
          >
            {/* Hour grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {hours.map((_, idx) => (
                <div key={idx} className="flex-1 border-r border-rose-200/70" />
              ))}
            </div>
            {/* Midnight day boundary */}
            {midnightVisual > 0 && midnightVisual < 24 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                style={{ left: `${(midnightVisual / 24) * 100}%`, background: 'repeating-linear-gradient(to bottom, #6366f1 0px, #6366f1 4px, transparent 4px, transparent 8px)' }}
              />
            )}
            {/* Uncertainty overlay when tomorrow has no data */}
            {!tomorrowHasData && midnightVisual > 0 && midnightVisual < 24 && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{
                  left: `${(midnightVisual / 24) * 100}%`,
                  right: 0,
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(245,158,11,0.12) 4px, rgba(245,158,11,0.12) 8px)',
                  borderLeft: '1px dashed #f59e0b',
                }}
              />
            )}
            {/* Now indicator — near left edge */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
              style={{ left: `${(nowVisual / 24) * 100}%` }}
            />
            {/* Power periods (visual segments handle wrapping) */}
            {powerSchedule.periods.map((period, index) =>
              renderSegments(period, index, 'power', 'power', '#059669', '#10b98133', () => handleRemovePowerPeriod(index), powerScheduleLocked)
            )}
          </div>
        </div>

        {appliances.filter(a => a.enabled).map((appliance) => (
          <div key={appliance.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <div className="sm:w-20 md:w-28 flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                style={{ backgroundColor: appliance.color }}
              />
              <span className="text-xs sm:text-sm text-slate-900 font-medium leading-tight line-clamp-2">
                {appliance.nameUa}
              </span>
            </div>

            <div
              className="timeline-container flex-none sm:flex-1 h-12 bg-slate-50 rounded-xl relative cursor-pointer overflow-hidden ring-1 ring-inset ring-slate-200"
              style={{ touchAction: 'none' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const visualHour = ((e.clientX - rect.left) / rect.width) * 24;
                handleAddRange(appliance.id, toAbsolute(visualHour));
              }}
            >
              {/* Hour grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {hours.map((_, idx) => (
                  <div
                    key={idx}
                    className="flex-1 border-r border-slate-200/80"
                  />
                ))}
              </div>
              {/* Midnight day boundary */}
              {midnightVisual > 0 && midnightVisual < 24 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                  style={{ left: `${(midnightVisual / 24) * 100}%`, background: 'repeating-linear-gradient(to bottom, #6366f1 0px, #6366f1 4px, transparent 4px, transparent 8px)' }}
                />
              )}
              {/* Uncertainty overlay when tomorrow has no data */}
              {!tomorrowHasData && midnightVisual > 0 && midnightVisual < 24 && (
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{
                    left: `${(midnightVisual / 24) * 100}%`,
                    right: 0,
                    background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(245,158,11,0.12) 4px, rgba(245,158,11,0.12) 8px)',
                    borderLeft: '1px dashed #f59e0b',
                  }}
                />
              )}
              {/* Now indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: `${(nowVisual / 24) * 100}%` }}
              />

              {/* Always-on indicator (no schedule = works 24h) — click to convert to editable range */}
              {appliance.schedule.length === 0 && (
                <div
                  className="absolute top-1.5 bottom-1.5 left-0 right-0 rounded-md flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: `${appliance.color}18`,
                    border: `2px dashed ${appliance.color}60`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Convert to explicit 0-24 range so user can drag/resize
                    onChange(
                      appliances.map((a) =>
                        a.id === appliance.id
                          ? { ...a, schedule: [{ start: 0, end: 24 }] }
                          : a
                      )
                    );
                  }}
                  title="Клікніть щоб редагувати розклад"
                >
                  <span className="text-xs font-semibold text-slate-700">
                    24 год — клікніть для зміни
                  </span>
                </div>
              )}

              {/* Time ranges (visual segments handle wrapping) */}
              {appliance.schedule.map((range, index) =>
                renderSegments(range, index, 'appliance', appliance.id, appliance.color, `${appliance.color}30`, () => handleRemoveRange(appliance.id, index))
              )}
            </div>
          </div>
        ))}

        {appliances.filter(a => !a.enabled).length > 0 && (
          <div className="text-sm text-slate-600 mt-4 text-center py-2.5 inset">
            Вимкнені прилади не відображаються у розкладі
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 sm:gap-6 text-xs text-slate-700 inset py-2.5 px-3 flex-wrap">
        <span>💡 Тап — додати</span>
        <span>🖱️ Тягнути — змінити</span>
        <span className="hidden sm:inline">🗑️ Подвійний клік — видалити</span>
        <span className="sm:hidden">❌ × — видалити</span>
      </div>
    </div>
  );
};
