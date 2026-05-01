'use client';

import { useEffect, useMemo, useState } from 'react';
import DateTimePicker from './DateTimePicker';

// Date-range picker with two modes:
//   - "range":  pick a start datetime + an end datetime explicitly
//   - "duration": pick a start datetime + a duration shortcut (1d/3d/1w/2w/1mo) or a custom day count
//
// Native <input type="datetime-local"> stays — it's familiar, accessible, and respects
// the OS locale. We theme it with `color-scheme: dark` plus a CSS filter on the picker
// indicator so the calendar icon matches the gold accent.
//
// Values are emitted as ISO 8601 UTC strings (what the API expects) via onChange.
// The local input itself uses datetime-local format ("YYYY-MM-DDTHH:mm"), so we
// convert at the boundary.

const DURATION_OPTIONS: { label: string; days: number }[] = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

interface Props {
  startIso: string;
  endIso: string;
  onChange: (next: { startIso: string; endIso: string }) => void;
  required?: boolean;
}

function isoToLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function addDays(iso: string, days: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function diffDays(startIso: string, endIso: string): number | null {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  const ms = e - s;
  const days = ms / (24 * 60 * 60 * 1000);
  // Only call it a "duration match" if it's a whole-day delta.
  return Math.abs(days - Math.round(days)) < 0.001 ? Math.round(days) : null;
}

export default function DateRangeField({ startIso, endIso, onChange, required }: Props) {
  // Default to "duration" when the caller already has a clean whole-day delta, otherwise
  // assume the user is editing precise dates and start in "range" mode.
  const initialMode: 'range' | 'duration' = diffDays(startIso, endIso) != null ? 'duration' : 'range';
  const [mode, setMode] = useState<'range' | 'duration'>(initialMode);
  const [customDays, setCustomDays] = useState<number | null>(null);

  const startLocal = isoToLocalInput(startIso);
  const endLocal = isoToLocalInput(endIso);
  const computedDays = useMemo(() => diffDays(startIso, endIso), [startIso, endIso]);

  // Keep customDays in sync when the parent recomputes the range outside of our control.
  useEffect(() => {
    if (mode === 'duration' && computedDays != null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local state with derived prop
      setCustomDays((prev) => (prev === computedDays ? prev : computedDays));
    }
  }, [computedDays, mode]);

  function setStart(localValue: string) {
    const nextStartIso = localInputToIso(localValue);
    if (mode === 'duration') {
      const days = customDays ?? computedDays ?? 7;
      onChange({ startIso: nextStartIso, endIso: addDays(nextStartIso, days) });
    } else {
      onChange({ startIso: nextStartIso, endIso });
    }
  }

  function setEnd(localValue: string) {
    onChange({ startIso, endIso: localInputToIso(localValue) });
  }

  function applyDuration(days: number) {
    setCustomDays(days);
    if (startIso) {
      onChange({ startIso, endIso: addDays(startIso, days) });
    }
  }

  function startNowSnapped() {
    // "Now snapped to the next minute" — gives a clean start time without the user
    // having to wrestle with the picker.
    const d = new Date();
    d.setSeconds(0, 0);
    const iso = d.toISOString();
    if (mode === 'duration') {
      const days = customDays ?? computedDays ?? 7;
      onChange({ startIso: iso, endIso: addDays(iso, days) });
    } else {
      onChange({ startIso: iso, endIso });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 text-xs">
        <ModeButton active={mode === 'range'} onClick={() => setMode('range')}>
          Date range
        </ModeButton>
        <ModeButton active={mode === 'duration'} onClick={() => setMode('duration')}>
          Duration
        </ModeButton>
        <button
          type="button"
          onClick={startNowSnapped}
          className="ml-auto px-2 py-1 text-[11px] text-text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          Start now
        </button>
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1">Start</label>
        <DateTimePicker
          value={startIso}
          onChange={(iso) => {
            if (mode === 'duration') {
              const days = customDays ?? computedDays ?? 7;
              onChange({ startIso: iso, endIso: iso ? addDays(iso, days) : '' });
            } else {
              onChange({ startIso: iso, endIso });
            }
          }}
          placeholder="Pick a start date…"
          ariaLabel="Start date and time"
          required={required}
        />
      </div>

      {mode === 'range' ? (
        <div>
          <label className="block text-xs text-text-muted mb-1">End</label>
          <DateTimePicker
            value={endIso}
            onChange={(iso) => onChange({ startIso, endIso: iso })}
            placeholder="Pick an end date…"
            ariaLabel="End date and time"
            required={required}
          />
        </div>
      ) : (
        <div>
          <label className="block text-xs text-text-muted mb-1">Duration</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DURATION_OPTIONS.map((opt) => {
              const active = (customDays ?? computedDays) === opt.days;
              return (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => applyDuration(opt.days)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    active
                      ? 'bg-gold/20 border-gold text-gold'
                      : 'border-card-border text-text-muted hover:border-gold/50 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Custom:</span>
            <input
              type="number"
              min={1}
              max={365}
              value={customDays ?? computedDays ?? ''}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n > 0) applyDuration(n);
              }}
              className="w-20 px-2 py-1 bg-brown-dark border border-card-border rounded text-sm focus:outline-none focus:border-gold"
              placeholder="7"
            />
            <span className="text-xs text-text-muted">days</span>
          </div>
          {endLocal && (
            <p className="text-[11px] text-text-muted mt-2">
              Ends <span className="text-foreground/80">{new Date(endLocal).toLocaleString()}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded transition-colors ${
        active ? 'bg-gold/20 text-gold border border-gold/40' : 'text-text-muted hover:text-foreground border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}
