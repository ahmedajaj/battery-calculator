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
}

export const TimelineScheduler: React.FC<Props> = ({ appliances, onChange, powerSchedule, onPowerScheduleChange, currentHour }) => {
  const [dragging, setDragging] = useState<{
    targetType: 'appliance' | 'power';
    targetId: string;
    rangeIndex: number;
    type: 'move' | 'start' | 'end';
    startX: number;
    originalRange: TimeRange;
  } | null>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);

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

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-cyan-50 rounded-xl">
          <Calendar className="w-5 h-5 text-cyan-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Розклад приладів</h2>
          <p className="text-sm text-slate-500">Клікніть для додавання періоду, тягніть краї для зміни</p>
        </div>
      </div>

      {/* Hour labels */}
      <div className="flex mb-2 pl-16 sm:pl-24 md:pl-28">
        {hours.map((hour) => (
          <div
            key={hour}
            className="flex-1 text-center text-xs text-slate-400 font-medium"
            style={{ minWidth: 0 }}
          >
            {hour % 3 === 0 ? `${hour}` : ''}
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
        <div className="flex items-center gap-3">
          <div className="w-12 sm:w-20 md:w-24 flex items-center gap-1 sm:gap-2 shrink-0">
            <Zap className="w-3 h-3 text-green-500" />
            <span className="text-xs sm:text-sm text-slate-600 truncate font-medium">Електрика</span>
          </div>
          <div
            className="timeline-container flex-1 h-12 bg-red-50 rounded-lg relative cursor-pointer overflow-hidden border border-slate-200 touch-action-none"
            style={{ touchAction: 'none' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const hour = (x / rect.width) * 24;
              handleAddPowerPeriod(hour);
            }}
          >
            {/* Hour grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {hours.map((hour) => (
                <div key={hour} className="flex-1 border-r border-red-200/50" />
              ))}
            </div>
            {/* Current time indicator */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
              style={{ left: `${(currentHour / 24) * 100}%` }}
            />
            {/* Power periods */}
            {powerSchedule.periods.map((period, index) => (
              <div
                key={index}
                className="absolute top-1.5 bottom-1.5 rounded-md flex items-center justify-center group cursor-move shadow-sm"
                style={{
                  left: `${(period.start / 24) * 100}%`,
                  width: `${((period.end - period.start) / 24) * 100}%`,
                  backgroundColor: '#22c55e30',
                  border: '2px solid #22c55e',
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => handlePointerDown(e, 'power', 'power', index, 'move')}
                onTouchStart={(e) => handlePointerDown(e, 'power', 'power', index, 'move')}
                onDoubleClick={() => handleRemovePowerPeriod(index)}
              >
                {/* Drag handles */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize hover:bg-black/10 active:bg-black/10 rounded-l"
                  onMouseDown={(e) => handlePointerDown(e, 'power', 'power', index, 'start')}
                  onTouchStart={(e) => handlePointerDown(e, 'power', 'power', index, 'start')}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize hover:bg-black/10 active:bg-black/10 rounded-r"
                  onMouseDown={(e) => handlePointerDown(e, 'power', 'power', index, 'end')}
                  onTouchStart={(e) => handlePointerDown(e, 'power', 'power', index, 'end')}
                />
                {/* Time label */}
                <span className="text-[10px] sm:text-xs font-semibold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 text-green-600 pointer-events-none">
                  <GripHorizontal className="w-3 h-3 hidden sm:block" />
                  {Math.floor(period.start)}:{period.start % 1 ? '30' : '00'}-{Math.floor(period.end)}:{period.end % 1 ? '30' : '00'}
                </span>
                <button
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-md sm:hidden z-10"
                  onClick={(e) => { e.stopPropagation(); handleRemovePowerPeriod(index); }}
                  onTouchStart={(e) => e.stopPropagation()}
                >×</button>
              </div>
            ))}
          </div>
        </div>

        {appliances.filter(a => a.enabled).map((appliance) => (
          <div key={appliance.id} className="flex items-center gap-3">
            <div className="w-12 sm:w-20 md:w-24 flex items-center gap-1 sm:gap-2 shrink-0">
              <div
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                style={{ backgroundColor: appliance.color }}
              />
              <span className="text-xs sm:text-sm text-slate-600 truncate font-medium">
                {appliance.nameUa}
              </span>
            </div>

            <div
              className="timeline-container flex-1 h-12 bg-slate-100 rounded-lg relative cursor-pointer overflow-hidden border border-slate-200"
              style={{ touchAction: 'none' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const hour = (x / rect.width) * 24;
                handleAddRange(appliance.id, hour);
              }}
            >
              {/* Hour grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 border-r border-slate-200"
                  />
                ))}
              </div>
              {/* Current time indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: `${(currentHour / 24) * 100}%` }}
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
                  <span className="text-xs font-medium" style={{ color: appliance.color }}>
                    24 год — клікніть для зміни
                  </span>
                </div>
              )}

              {/* Time ranges */}
              {appliance.schedule.map((range, index) => (
                <div
                  key={index}
                  className="absolute top-1.5 bottom-1.5 rounded-md flex items-center justify-center group cursor-move shadow-sm"
                  style={{
                    left: `${(range.start / 24) * 100}%`,
                    width: `${((range.end - range.start) / 24) * 100}%`,
                    backgroundColor: `${appliance.color}30`,
                    border: `2px solid ${appliance.color}`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => handlePointerDown(e, 'appliance', appliance.id, index, 'move')}
                  onTouchStart={(e) => handlePointerDown(e, 'appliance', appliance.id, index, 'move')}
                  onDoubleClick={() => handleRemoveRange(appliance.id, index)}
                >
                  {/* Drag handles */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize hover:bg-black/10 active:bg-black/10 rounded-l"
                    onMouseDown={(e) => handlePointerDown(e, 'appliance', appliance.id, index, 'start')}
                    onTouchStart={(e) => handlePointerDown(e, 'appliance', appliance.id, index, 'start')}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 sm:w-2 cursor-ew-resize hover:bg-black/10 active:bg-black/10 rounded-r"
                    onMouseDown={(e) => handlePointerDown(e, 'appliance', appliance.id, index, 'end')}
                    onTouchStart={(e) => handlePointerDown(e, 'appliance', appliance.id, index, 'end')}
                  />

                  {/* Time label */}
                  <span className="text-[10px] sm:text-xs font-semibold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none" style={{ color: appliance.color }}>
                    <GripHorizontal className="w-3 h-3 hidden sm:block" />
                    {Math.floor(range.start)}:{range.start % 1 ? '30' : '00'}-{Math.floor(range.end)}:{range.end % 1 ? '30' : '00'}
                  </span>
                  <button
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-md sm:hidden z-10"
                    onClick={(e) => { e.stopPropagation(); handleRemoveRange(appliance.id, index); }}
                    onTouchStart={(e) => e.stopPropagation()}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {appliances.filter(a => !a.enabled).length > 0 && (
          <div className="text-sm text-slate-400 mt-4 text-center py-2 bg-slate-50 rounded-lg">
            Вимкнені прилади не відображаються у розкладі
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 sm:gap-6 text-xs text-slate-500 bg-slate-50 rounded-lg py-2 flex-wrap">
        <span>💡 Тап — додати</span>
        <span>🖱️ Тягнути — змінити</span>
        <span className="hidden sm:inline">🗑️ Подвійний клік — видалити</span>
        <span className="sm:hidden">❌ × — видалити</span>
      </div>
    </div>
  );
};
