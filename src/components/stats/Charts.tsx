'use client';

// Small charting primitives, drawn as inline SVG and divs.
//
// No charting library on purpose: the three shapes we need are a line, a calendar grid and a ring,
// and every library that draws them costs 40-100 KB on a page a whole clan loads. These inherit the
// theme, render on the server as static markup, and have no runtime beyond the hover handler.

import { useState } from 'react';

// ── Line chart ───────────────────────────────────────────────────────────────────────────────────

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * A filled line chart over a dense series. Days with nothing gained are real zeroes, not gaps — a
 * chart that skipped them would make a fortnight of two good days look like continuous activity.
 */
export function LineChart({
  points,
  height = 140,
  format = (n: number) => n.toLocaleString(),
  ariaLabel,
}: {
  points: SeriesPoint[];
  height?: number;
  format?: (n: number) => string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="h-[140px] grid place-items-center text-sm text-text-muted border border-card-border rounded-lg bg-card-bg">
        Nothing recorded yet.
      </div>
    );
  }

  const W = 600;
  const H = height;
  const PAD = 6;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const x = (i: number) => PAD + i * stepX;
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const active = hover === null ? null : points[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="anvil-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#anvil-line-fill)" />
        <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {active && (
          <line
            x1={x(hover!)}
            y1={PAD}
            x2={x(hover!)}
            y2={H - PAD}
            stroke="var(--gold)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            opacity={0.6}
          />
        )}
        {/* One hit area per point, so hovering anywhere in a column reads that day. */}
        {points.map((p, i) => (
          <rect
            key={p.label}
            x={x(i) - stepX / 2}
            y={0}
            width={Math.max(stepX, 2)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[11px] text-text-muted mt-1">
        <span>{points[0].label}</span>
        <span className={active ? 'text-foreground' : ''}>
          {active ? `${active.label} · ${format(active.value)}` : `peak ${format(max)}`}
        </span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

// ── Activity heatmap ─────────────────────────────────────────────────────────────────────────────

export interface HeatmapDay {
  day: string;
  value: number;
}

/**
 * A calendar grid of activity, one column per week. Buckets are relative to the person's own best
 * day rather than an absolute scale: the question it answers is "when were they playing", and a
 * fixed scale would render a casual player's whole year as blank.
 */
export function ActivityHeatmap({ days, ariaLabel }: { days: HeatmapDay[]; ariaLabel: string }) {
  if (days.length === 0) {
    return <div className="text-sm text-text-muted">No activity recorded yet.</div>;
  }

  const max = Math.max(...days.map((d) => d.value), 1);
  // Buckets are relative to this person's own best day, not an absolute scale: the question is "when
  // were they playing", and a fixed scale renders a casual player's whole year as blank.
  const level = (v: number) => {
    if (v <= 0) return 0;
    const ratio = v / max;
    if (ratio > 0.66) return 4;
    if (ratio > 0.33) return 3;
    if (ratio > 0.1) return 2;
    return 1;
  };
  const shades = [
    'bg-brown-dark border-card-border',
    'bg-gold/20 border-gold/25',
    'bg-gold/40 border-gold/40',
    'bg-gold/65 border-gold/60',
    'bg-gold border-gold',
  ];

  // Snap the range to whole weeks at both ends, so every column has seven cells and the grid is a
  // rectangle. Without it the first and last columns are stubs — correct (a year doesn't start on a
  // Sunday) but it reads as a rendering fault. Days outside the supplied range render as empty, the
  // same as a day with nothing on it, which is what a contribution graph does with the rest of the
  // current week.
  const valueByDay = new Map(days.map((d) => [d.day, d.value]));
  const dayMs = 86_400_000;
  const firstGiven = new Date(`${days[0].day}T00:00:00Z`);
  const lastGiven = new Date(`${days[days.length - 1].day}T00:00:00Z`);
  const gridStart = new Date(firstGiven.getTime() - firstGiven.getUTCDay() * dayMs);
  const gridEnd = new Date(lastGiven.getTime() + (6 - lastGiven.getUTCDay()) * dayMs);

  const weeks: { day: string; value: number; inRange: boolean }[][] = [];
  for (let t = gridStart.getTime(); t <= gridEnd.getTime(); t += 7 * dayMs) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(t + d * dayMs).toISOString().slice(0, 10);
      week.push({ day, value: valueByDay.get(day) ?? 0, inRange: valueByDay.has(day) });
    }
    weeks.push(week);
  }

  // A month label sits above the first week containing a day of that month.
  const monthLabels = weeks.map((week, i) => {
    const month = week[0].day.slice(0, 7);
    if (i === 0) return '';
    if (weeks[i - 1][0].day.slice(0, 7) === month) return '';
    return new Date(`${week[0].day}T00:00:00Z`).toLocaleString(undefined, { month: 'short' });
  });

  const COL = '0.75rem';
  const track = { gridTemplateColumns: `repeat(${weeks.length}, ${COL})` };
  // Sunday-first, labelling alternate rows the way GitHub does — seven labels would be unreadable at
  // this size, and three is enough to orient a column.
  const weekdays = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1.5">
          <div className="grid grid-rows-7 gap-[3px] pt-[15px] text-[9px] leading-3 text-text-muted">
            {weekdays.map((d, i) => (
              <span key={i} className="h-3 flex items-center">
                {d}
              </span>
            ))}
          </div>

          <div>
            <div className="grid gap-[3px] mb-1 text-[9px] leading-3 text-text-muted" style={track}>
              {monthLabels.map((label, i) => (
                <span key={i} className="whitespace-nowrap">
                  {label}
                </span>
              ))}
            </div>
            <div className="grid grid-rows-7 grid-flow-col gap-[3px]" role="img" aria-label={ariaLabel}>
              {weeks.flat().map((cell) => (
                <span
                  key={cell.day}
                  title={
                    cell.inRange
                      ? `${cell.day} — ${cell.value > 0 ? `${cell.value.toFixed(2)}h` : 'nothing'}`
                      : cell.day
                  }
                  className={`w-3 h-3 rounded-[2px] border ${shades[level(cell.value)]}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-2 text-[10px] text-text-muted">
        <span>Less</span>
        {shades.map((shade, i) => (
          <span key={i} className={`w-3 h-3 rounded-[2px] border ${shade}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── Progress ring ────────────────────────────────────────────────────────────────────────────────

/** A circular progress dial — used for "nearest 99s", where the fraction is the whole story. */
export function ProgressRing({
  progress,
  label,
  sub,
  size = 56,
}: {
  progress: number;
  label: string;
  sub: string;
  size?: number;
}) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, progress)) * circumference;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--card-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      {/* Callers that lay the caption out themselves pass empty strings — rendering the block
          anyway left an invisible column that pushed the rings off-centre. */}
      {(label || sub) && (
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-text-muted truncate">{sub}</div>
        </div>
      )}
    </div>
  );
}

// ── Proportional bar ─────────────────────────────────────────────────────────────────────────────

/** A row's share of the largest row — turns a column of numbers into something scannable. */
export function Bar({ value, max, muted }: { value: number; max: number; muted?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="block h-1.5 w-full rounded-full bg-brown-dark overflow-hidden" aria-hidden>
      <span
        className={`block h-full rounded-full ${muted ? 'bg-text-muted/30' : 'bg-gold/70'}`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
