import React, { useState, useCallback } from 'react';
import { Calendar, GripHorizontal, Zap } from 'lucide-react';
import type { Appliance, TimeRange, PowerSchedule } from '../types';

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

  const handleAddRange = (applianceId: string, hour: number) => {
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

  const handleAddPowerPeriod = (hour: number) => {
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

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
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
        startX: e.clientX,
        originalRange,
      });
    },
    [appliances, powerSchedule]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, containerWidth: number) => {
      if (!dragging) return;

      const deltaX = e.clientX - dragging.startX;
      const deltaHours = Math.round((deltaX / containerWidth) * 24);

      const range = { ...dragging.originalRange };

      if (dragging.type === 'move') {
        const duration = range.end - range.start;
        range.start = Math.max(0, Math.min(24 - duration, range.start + deltaHours));
        range.end = range.start + duration;
      } else if (dragging.type === 'start') {
        range.start = Math.max(0, Math.min(range.end - 1, range.start + deltaHours));
      } else if (dragging.type === 'end') {
        range.end = Math.max(range.start + 1, Math.min(24, range.end + deltaHours));
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

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
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
      <div className="flex mb-2 pl-28">
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
            handleMouseMove(e, container.clientWidth);
          }
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Power schedule bar */}
        <div className="flex items-center gap-3">
          <div className="w-24 flex items-center gap-2 shrink-0">
            <Zap className="w-3 h-3 text-green-500" />
            <span className="text-sm text-slate-600 truncate font-medium">Електрика</span>
          </div>
          <div
            className="timeline-container flex-1 h-12 bg-red-50 rounded-lg relative cursor-pointer overflow-hidden border border-slate-200"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const hour = Math.floor((x / rect.width) * 24);
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
                onMouseDown={(e) => handleMouseDown(e, 'power', 'power', index, 'move')}
                onDoubleClick={() => handleRemovePowerPeriod(index)}
              >
                {/* Drag handles */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-l"
                  onMouseDown={(e) => handleMouseDown(e, 'power', 'power', index, 'start')}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-r"
                  onMouseDown={(e) => handleMouseDown(e, 'power', 'power', index, 'end')}
                />
                {/* Time label */}
                <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-green-600">
                  <GripHorizontal className="w-3 h-3" />
                  {period.start}:00 - {period.end}:00
                </span>
              </div>
            ))}
          </div>
        </div>

        {appliances.filter(a => a.enabled).map((appliance) => (
          <div key={appliance.id} className="flex items-center gap-3">
            <div className="w-24 flex items-center gap-2 shrink-0">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: appliance.color }}
              />
              <span className="text-sm text-slate-600 truncate font-medium">
                {appliance.nameUa}
              </span>
            </div>

            <div
              className="timeline-container flex-1 h-12 bg-slate-100 rounded-lg relative cursor-pointer overflow-hidden border border-slate-200"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const hour = Math.floor((x / rect.width) * 24);
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
                  onMouseDown={(e) => handleMouseDown(e, 'appliance', appliance.id, index, 'move')}
                  onDoubleClick={() => handleRemoveRange(appliance.id, index)}
                >
                  {/* Drag handles */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-l"
                    onMouseDown={(e) => handleMouseDown(e, 'appliance', appliance.id, index, 'start')}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-r"
                    onMouseDown={(e) => handleMouseDown(e, 'appliance', appliance.id, index, 'end')}
                  />

                  {/* Time label */}
                  <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1" style={{ color: appliance.color }}>
                    <GripHorizontal className="w-3 h-3" />
                    {range.start}:00 - {range.end}:00
                  </span>
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

      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-500 bg-slate-50 rounded-lg py-2">
        <span>💡 Клік — додати</span>
        <span>🖱️ Тягнути — змінити</span>
        <span>🗑️ Подвійний клік — видалити</span>
      </div>
    </div>
  );
};
