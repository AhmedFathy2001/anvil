'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatUtcHint } from '@/lib/eventTime';

// Self-contained custom date+time picker. Renders a button showing the current value
// (or a placeholder) and opens a popover with a month-grid calendar plus HH:MM inputs.
// No date library — just Date math. Themed entirely with the project's tailwind tokens.
//
// `value` is an ISO 8601 string in UTC (matches API expectations). The popover uses
// the user's local timezone for display + interaction; the conversion happens at the
// boundary in this component so consumers can stay in ISO/UTC.

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function toLocalParts(iso: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    y: date.getFullYear(),
    m: date.getMonth(),
    d: date.getDate(),
    hh: date.getHours(),
    mm: date.getMinutes(),
  };
}

function partsToIso(y: number, m: number, d: number, hh: number, mm: number): string {
  // new Date(y, m, d, hh, mm) interprets in local TZ — exactly what we want, then
  // .toISOString() shifts to UTC for transport.
  return new Date(y, m, d, hh, mm, 0, 0).toISOString();
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Locale-friendly: "Jan 5, 2026 · 14:30"
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${date} · ${time}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

// Build a 6-row × 7-col grid of dates anchored to the given month. Cells outside
// the month are still real dates from the prev/next month — easier to handle than
// nullable cells.
function buildGrid(y: number, m: number): { y: number; m: number; d: number; outside: boolean }[][] {
  const firstDow = new Date(y, m, 1).getDay();
  const total = daysInMonth(y, m);
  const prevTotal = daysInMonth(y, m - 1);
  const cells: { y: number; m: number; d: number; outside: boolean }[] = [];

  for (let i = 0; i < firstDow; i++) {
    const d = prevTotal - firstDow + 1 + i;
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    cells.push({ y: py, m: pm, d, outside: true });
  }
  for (let d = 1; d <= total; d++) cells.push({ y, m, d, outside: false });
  while (cells.length < 42) {
    const offset = cells.length - firstDow - total + 1;
    const nm = m === 11 ? 0 : m + 1;
    const ny = m === 11 ? y + 1 : y;
    cells.push({ y: ny, m: nm, d: offset, outside: true });
  }

  const rows: { y: number; m: number; d: number; outside: boolean }[][] = [];
  for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7));
  return rows;
}

function sameDay(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number } | null): boolean {
  return Boolean(b && a.y === b.y && a.m === b.m && a.d === b.d);
}

export default function DateTimePicker({ value, onChange, placeholder, ariaLabel, required }: Props) {
  const parsed = toLocalParts(value);
  const today = useMemo(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  }, []);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.y);
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.m);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-anchor the calendar view to the current value whenever the popover opens, so
  // the user always sees the month their selection lives in (or the current month if unset).
  useEffect(() => {
    if (!open) return;
    const p = toLocalParts(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing view to opened state
    setViewYear(p?.y ?? today.y);
    setViewMonth(p?.m ?? today.m);
  }, [open, value, today.y, today.m]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function pickDay(day: { y: number; m: number; d: number; outside: boolean }) {
    const hh = parsed?.hh ?? 0;
    const mm = parsed?.mm ?? 0;
    onChange(partsToIso(day.y, day.m, day.d, hh, mm));
    if (day.outside) {
      setViewYear(day.y);
      setViewMonth(day.m);
    }
  }

  function changeTime(field: 'hh' | 'mm', raw: string) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    const cur = parsed ?? { y: today.y, m: today.m, d: today.d, hh: 0, mm: 0 };
    const next = {
      ...cur,
      [field]: field === 'hh' ? Math.max(0, Math.min(23, n)) : Math.max(0, Math.min(59, n)),
    };
    onChange(partsToIso(next.y, next.m, next.d, next.hh, next.mm));
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  function setNow() {
    const d = new Date();
    d.setSeconds(0, 0);
    onChange(d.toISOString());
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm transition-colors hover:border-gold/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 ${
          open ? 'border-gold/60 ring-1 ring-gold/30' : ''
        } ${value ? 'text-foreground' : 'text-text-muted'}`}
      >
        <span className="truncate text-left">{value ? formatDisplay(value) : placeholder ?? 'Pick a date…'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70 shrink-0" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {required && (
        // Hidden mirror so native form validation still triggers if a parent <form>
        // expects `required`. The visible button isn't a form control on its own.
        <input
          type="text"
          value={value}
          tabIndex={-1}
          onChange={() => {}}
          required
          className="sr-only absolute inset-0 pointer-events-none opacity-0"
          aria-hidden
        />
      )}

      {value && (
        // The button shows local time; this spells out the UTC equivalent that
        // actually gets stored, so admins don't mistake their local midnight for
        // UTC midnight.
        <p className="mt-1 text-[11px] text-text-muted/80">= {formatUtcHint(value)}</p>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Date and time picker"
          className="absolute z-50 mt-2 w-72 rounded-xl border border-gold/30 bg-card-bg shadow-2xl shadow-black/50 p-3"
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 rounded hover:bg-brown-light text-text-muted hover:text-foreground transition-colors flex items-center justify-center"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="text-sm font-semibold text-gold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 rounded hover:bg-brown-light text-text-muted hover:text-foreground transition-colors flex items-center justify-center"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-[10px] text-text-muted/70 uppercase tracking-wider mb-1 text-center">
            {WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-3">
            {grid.flat().map((day, i) => {
              const isSelected = parsed && sameDay(day, parsed);
              const isToday = sameDay(day, today);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`h-8 text-xs rounded transition-colors ${
                    isSelected
                      ? 'bg-gold text-brown-dark font-bold'
                      : day.outside
                        ? 'text-text-muted/40 hover:bg-brown-light/40'
                        : isToday
                          ? 'text-gold border border-gold/40 hover:bg-gold/10'
                          : 'text-foreground hover:bg-brown-light'
                  }`}
                >
                  {day.d}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-card-border pt-3">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Time</span>
            <input
              type="number"
              min={0}
              max={23}
              value={parsed ? pad2(parsed.hh) : ''}
              onChange={(e) => changeTime('hh', e.target.value)}
              placeholder="HH"
              className="w-12 px-2 py-1 bg-brown-dark border border-card-border rounded text-sm text-center focus:outline-none focus:border-gold"
            />
            <span className="text-text-muted">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={parsed ? pad2(parsed.mm) : ''}
              onChange={(e) => changeTime('mm', e.target.value)}
              placeholder="MM"
              className="w-12 px-2 py-1 bg-brown-dark border border-card-border rounded text-sm text-center focus:outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={setNow}
              className="ml-auto text-[11px] text-gold hover:text-gold-light underline-offset-2 hover:underline"
            >
              Now
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-card-border mt-3 pt-2">
            <button
              type="button"
              onClick={clear}
              className="text-[11px] text-text-muted hover:text-red-400 underline-offset-2 hover:underline"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-gold hover:text-gold-light"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
