import React from 'react';
import { Clock, Sun, Moon } from 'lucide-react';
import type { PowerSchedule } from '../types';

interface Props {
  schedule: PowerSchedule;
  onChange: (schedule: PowerSchedule) => void;
}

export const PowerSchedulePanel: React.FC<Props> = ({ schedule, onChange }) => {
  const handleChange = (key: keyof PowerSchedule, value: string) => {
    onChange({ ...schedule, [key]: value });
  };

  // Calculate duration
  const onHour = parseFloat(schedule.powerOnTime.replace(':', '.'));
  const offHour = parseFloat(schedule.powerOffTime.replace(':', '.'));
  let powerOnDuration = offHour - onHour;
  if (powerOnDuration < 0) powerOnDuration += 24;
  const powerOffDuration = 24 - powerOnDuration;

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-amber-50 rounded-xl">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">График электричества</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm text-slate-600 flex items-center gap-2">
            <Sun className="w-4 h-4 text-green-500" />
            Включение света
          </label>
          <input
            type="time"
            value={schedule.powerOnTime}
            onChange={(e) => handleChange('powerOnTime', e.target.value)}
            className="w-full bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-slate-800 text-lg font-mono focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-600 flex items-center gap-2">
            <Moon className="w-4 h-4 text-red-500" />
            Отключение света
          </label>
          <input
            type="time"
            value={schedule.powerOffTime}
            onChange={(e) => handleChange('powerOffTime', e.target.value)}
            className="w-full bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-slate-800 text-lg font-mono focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
          />
        </div>
      </div>

      {/* Visual timeline */}
      <div className="space-y-3">
        <div className="text-sm text-slate-500">Визуализация дня</div>
        <div className="relative h-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
          {/* 24-hour background with markers */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex-1 border-r border-slate-200 relative"
              >
                {i % 6 === 0 && (
                  <span className="absolute -bottom-5 left-0 text-xs text-slate-400 transform -translate-x-1/2">
                    {i}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Power on period */}
          <PowerPeriodBar
            startTime={schedule.powerOnTime}
            endTime={schedule.powerOffTime}
          />
        </div>
        <div className="h-4" /> {/* Spacer for time labels */}

        {/* Duration info */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-600">
              <Sun className="w-4 h-4" />
              <span className="text-sm font-medium">Свет есть</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {powerOnDuration.toFixed(1)} ч
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-600">
              <Moon className="w-4 h-4" />
              <span className="text-sm font-medium">Свет отключен</span>
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {powerOffDuration.toFixed(1)} ч
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PowerPeriodBar: React.FC<{ startTime: string; endTime: string }> = ({
  startTime,
  endTime,
}) => {
  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h + m / 60;
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (start <= end) {
    // Normal case: start to end on same day
    return (
      <div
        className="absolute top-0 bottom-0 bg-gradient-to-r from-green-400 to-green-300"
        style={{
          left: `${(start / 24) * 100}%`,
          width: `${((end - start) / 24) * 100}%`,
        }}
      />
    );
  } else {
    // Overnight case: start to midnight + midnight to end
    return (
      <>
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-green-400 to-green-300"
          style={{
            left: `${(start / 24) * 100}%`,
            width: `${((24 - start) / 24) * 100}%`,
          }}
        />
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-green-400 to-green-300"
          style={{
            left: '0%',
            width: `${(end / 24) * 100}%`,
          }}
        />
      </>
    );
  }
};
