import type { ChangeEvent } from 'react';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}

const MINUTES = ['00', '15', '30', '45'];
const QUICK_TIMES = [
  { value: '16:00', title: 'Nach Schule', icon: '🎒' },
  { value: '18:00', title: 'Afterwork', icon: '🍕' },
  { value: '20:00', title: 'Prime Time', icon: '🎉' },
  { value: '22:00', title: 'Late Night', icon: '🌙' },
];
const QUICK_OFFSETS_MINUTES = [15, 30, 60];

function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function findNearestQuarter(minutes: number): string {
  return MINUTES.reduce((closest, minuteOption) => {
    const minuteNumber = Number(minuteOption);
    const currentDiff = Math.abs(minuteNumber - minutes);
    const closestDiff = Math.abs(Number(closest) - minutes);
    return currentDiff < closestDiff ? minuteOption : closest;
  }, MINUTES[0]);
}

function normalizeTime(raw: string): string | null {
  if (!raw.includes(':')) {
    return null;
  }

  const [hoursRaw, minutesRaw] = raw.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const nearestMinute = Number(findNearestQuarter(minutes));
  return formatTime(hours, nearestMinute);
}

function parseTimeToDate(base: Date, time: string): Date | null {
  const normalized = normalizeTime(time);
  if (!normalized) {
    return null;
  }
  const [hoursRaw, minutesRaw] = normalized.split(':');
  const date = new Date(base);
  date.setHours(Number(hoursRaw), Number(minutesRaw), 0, 0);
  return date;
}

export default function TimePicker({ value, onChange, label }: TimePickerProps) {
  const isExpandedMode = Boolean(label);
  const normalizedValue = normalizeTime(value) ?? '';

  const handleNativeTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = normalizeTime(raw);
    if (!normalized) {
      return;
    }
    onChange(normalized);
  };

  const applyOffsetFromNow = (minutesToAdd: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutesToAdd);
    const rounded = normalizeTime(formatTime(now.getHours(), now.getMinutes()));
    if (rounded) {
      onChange(rounded);
    }
  };

  const applyOffsetFromSelected = (minutesToAdd: number) => {
    const base = parseTimeToDate(new Date(), normalizedValue);
    if (!base) {
      applyOffsetFromNow(minutesToAdd);
      return;
    }
    base.setMinutes(base.getMinutes() + minutesToAdd);
    const rounded = normalizeTime(formatTime(base.getHours(), base.getMinutes()));
    if (rounded) {
      onChange(rounded);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <input
        type="time"
        value={normalizedValue}
        step={900}
        onChange={handleNativeTimeChange}
        className="input font-mono text-lg tracking-tight"
      />

      {isExpandedMode && (
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-slate-800/50">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_TIMES.map((option) => {
              const isSelected = normalizedValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  className={`rounded-2xl border px-3 py-2 text-left transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-sky-100 text-sky-800 shadow-sm dark:bg-sky-900/30 dark:text-sky-200'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:border-sky-600'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{option.title}</p>
                  <p className="mt-0.5 font-mono text-base font-black">
                    {option.icon} {option.value}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {QUICK_OFFSETS_MINUTES.map((offset) => (
              <button
                key={offset}
                type="button"
                onClick={() => applyOffsetFromSelected(offset)}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-all hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:border-sky-500 dark:hover:bg-sky-900/20 dark:hover:text-sky-300"
              >
                +{offset} Min
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
