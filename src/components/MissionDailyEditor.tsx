'use client';

import { useMemo } from 'react';
import Input from '@/components/Input';
import type { MissionDaily } from '@/lib/eventRules';
import { slotLabelsForDay } from '@/lib/missionSchedule';
import { localDayKey } from '@/lib/zonedTime';

/**
 * The recurring drop schedule: what time missions land, and how many land each day of the week.
 *
 * Deliberately shaped like the sentence hosts say out loud — "one a day around nine, two on
 * weekends" — rather than like a cron expression. The two controls are the two facts they know: when
 * people are online, and which days are busier.
 *
 * The preview underneath is not decoration. A window rolls a different time each day, so the only
 * honest way to show what was configured is to show the next few days of it.
 */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A sane starting point: one drop a day at 20:00 local, two at weekends. */
export function DEFAULT_DAILY(): MissionDaily {
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    /* a browser with no zone info keeps UTC */
  }
  return { timezone, times: ['20:00'], window: null, perDay: [2, 1, 1, 1, 1, 1, 2] };
}

export default function MissionDailyEditor({
  value,
  onChange,
  eventId,
}: {
  value: MissionDaily;
  onChange: (next: MissionDaily) => void;
  /** Seeds the window roll, so the preview shows the times this board will really use. */
  eventId: number;
}) {
  const mode: 'times' | 'window' = value.window ? 'window' : 'times';

  // The next week as the schedule will actually run it.
  const preview = useMemo(() => {
    const today = localDayKey(Date.now(), value.timezone);
    const [y, m, d] = today.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 1, d + i));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      return { key, weekday: date.getUTCDay(), times: slotLabelsForDay(value, key, eventId) };
    });
  }, [value, eventId]);

  const totalPerWeek = value.perDay.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3 rounded-lg border border-card-border/60 bg-black/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {(['times', 'window'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() =>
                onChange(
                  m === 'window'
                    ? { ...value, window: value.window ?? { from: '18:00', to: '23:00' } }
                    : { ...value, window: null, times: value.times.length ? value.times : ['20:00'] },
                )
              }
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${mode === m ? 'bg-gold text-brown-dark' : 'bg-card-border/40 text-text-muted'}`}
            >
              {m === 'times' ? 'At set times' : 'Somewhere in a window'}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-text-muted">
          {mode === 'times'
            ? 'Predictable — people can plan to be online for it.'
            : 'Rolled fresh each day, so nobody can camp the exact minute.'}
        </span>
      </div>

      {mode === 'times' ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span>Drop at</span>
          <Input
            type="text"
            value={value.times.join(', ')}
            onChange={(e) =>
              onChange({ ...value, times: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
            }
            placeholder="20:00, 22:30"
            className="w-40"
            aria-label="Drop times"
          />
          <span className="text-text-muted/60">
            local time, comma separated — a day dropping two missions uses the first two
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span>Somewhere between</span>
          <Input
            type="text"
            value={value.window?.from ?? ''}
            onChange={(e) => onChange({ ...value, window: { from: e.target.value, to: value.window?.to ?? '23:00' } })}
            placeholder="18:00"
            className="w-20"
            aria-label="Window start"
          />
          <span>and</span>
          <Input
            type="text"
            value={value.window?.to ?? ''}
            onChange={(e) => onChange({ ...value, window: { from: value.window?.from ?? '18:00', to: e.target.value } })}
            placeholder="23:00"
            className="w-20"
            aria-label="Window end"
          />
          <span className="text-text-muted/60">local time</span>
        </div>
      )}

      <div>
        <label className="block text-xs text-text-muted mb-1.5">
          Drops per day <span className="text-text-muted/60">(0 skips the day entirely)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-text-muted">{label}</span>
              <Input
                type="number"
                min="0"
                max="12"
                value={String(value.perDay[i] ?? 0)}
                onChange={(e) => {
                  const perDay = [...value.perDay];
                  perDay[i] = Math.max(0, Math.min(12, parseInt(e.target.value, 10) || 0));
                  onChange({ ...value, perDay });
                }}
                className="w-12 text-center"
                aria-label={`Drops on ${label}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>Time zone</span>
        <Input
          type="text"
          value={value.timezone}
          onChange={(e) => onChange({ ...value, timezone: e.target.value.trim() })}
          placeholder="Europe/London"
          className="w-48"
          aria-label="Time zone"
        />
        <span className="text-text-muted/60">the clan&apos;s own clock — the times above survive DST</span>
      </div>

      <div className="border-t border-card-border/60 pt-2.5">
        <p className="text-[10px] text-text-muted mb-1.5">
          Next seven days — {totalPerWeek} mission{totalPerWeek === 1 ? '' : 's'} a week:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
          {preview.map((day) => (
            <div key={day.key} className="flex gap-1.5">
              <span className="text-text-muted w-8">{DAY_LABELS[day.weekday]}</span>
              <span className={day.times.length ? 'text-foreground' : 'text-text-muted/50'}>
                {day.times.length ? day.times.join(', ') : '—'}
              </span>
            </div>
          ))}
        </div>
        {value.perDay.every((n) => n === 0) && (
          <p className="text-[10px] text-amber-300 mt-1.5">Every day is set to zero, so nothing will ever drop.</p>
        )}
      </div>
    </div>
  );
}
