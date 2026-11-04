'use client';

import { useMemo } from 'react';
import Select from '@/components/Select';
import { cn } from '@/lib/utils';

// A time of day as 'HH:mm' (24-hour) — the same string a native <input type="time"> hands over — so
// a call site swaps the browser's clock widget for two of our dropdowns without touching its parsing.
// Every minute is offered, as the native field allowed; the minute list filters as you type ("3"
// narrows to 03, 13, 23…). An empty `value` shows placeholders until both halves are picked.

interface Props {
  value: string;
  onChange: (hhmm: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: pad(h), label: pad(h) }));
const MINUTES = Array.from({ length: 60 }, (_, m) => ({ value: pad(m), label: pad(m) }));

export default function TimeSelect({ value, onChange, ariaLabel = 'Time', disabled, className }: Props) {
  const [hh, mm] = useMemo(() => {
    const m = /^(\d{2}):(\d{2})/.exec(value);
    return m ? [m[1], m[2]] : ['', ''];
  }, [value]);
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex items-center gap-1', className)}>
      <Select
        value={hh}
        onChange={(h) => onChange(`${h}:${mm || '00'}`)}
        options={HOURS}
        placeholder="HH"
        ariaLabel={`${ariaLabel} hour`}
        disabled={disabled}
        className="w-[4.75rem]"
      />
      <span className="text-text-muted" aria-hidden>:</span>
      <Select
        value={mm}
        onChange={(m) => onChange(`${hh || '00'}:${m}`)}
        options={MINUTES}
        placeholder="MM"
        ariaLabel={`${ariaLabel} minute`}
        disabled={disabled}
        className="w-[4.75rem]"
      />
    </div>
  );
}
