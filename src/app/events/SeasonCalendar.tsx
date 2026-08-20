'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { hubKind } from '@/lib/hubKinds';
import type { CalendarItem } from '@/lib/eventsCalendar';
import ClanLink from '@/components/ClanLink';

/**
 * The season: boards and weeks on one axis.
 *
 * Weeks get FIXED lanes by type — Skill, Boss, Other — so a second Skill week in the same week
 * stacks under the first instead of reshuffling every bar on the strip. Boards pack greedily,
 * because they overlap in whatever way the clan happened to schedule them, and a three-week bingo
 * crossing three Skill weeks is exactly the thing this is here to show.
 *
 * Zoom is client-side over data the server already sent: a year of bars is a year of names and
 * spans, which is small, and refetching on every zoom would be worse than sending it once.
 */

const WEEK_MS = 7 * 86_400_000;
const ROW_H = 26;
const ROW_GAP = 4;

const ZOOMS = [
  { weeks: 6, label: '6 weeks' },
  { weeks: 16, label: 'Season' },
  { weeks: 52, label: 'Year' },
] as const;

interface Lane {
  name: string;
  rows: { item: CalendarItem; left: number; width: number }[][];
}

export default function SeasonCalendar({
  items,
  weeksAhead = 3,
}: {
  items: CalendarItem[];
  /** Must match the loader: the window ends this far past today so what's next is in frame. */
  weeksAhead?: number;
}) {
  const [zoom, setZoom] = useState<number>(16);
  const [hover, setHover] = useState<{ item: CalendarItem; x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackPx, setTrackPx] = useState(900);

  // A label narrower than its text is a smear, so the bar keeps only its dot. Needs real pixels.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackPx(el.clientWidth || 900);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rendered on the client only: the window is anchored to "now", and the server's now is not the
  // viewer's. Until it mounts there is nothing to draw.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const view = useMemo(() => {
    if (now == null) return null;
    const end = now + weeksAhead * WEEK_MS;
    const start = end - zoom * WEEK_MS;
    const span = end - start;
    const pos = (t: number) => ((t - start) / span) * 100;

    const inWindow = items.filter((i) => Date.parse(i.end) >= start && Date.parse(i.start) <= end);

    const laneFor = (name: string, keep: (i: CalendarItem) => boolean): Lane => {
      const placed = inWindow
        .filter(keep)
        .map((item) => {
          const l = Math.max(0, pos(Date.parse(item.start)));
          const r = Math.min(100, pos(Date.parse(item.end)));
          return { item, left: l, width: Math.max(0.8, r - l) };
        })
        .sort((a, b) => a.left - b.left);

      // First-fit packing. Two bars that merely touch — a week ending as the next begins — share a
      // row; the gap in the bar's own width keeps them visually apart.
      const rows: Lane['rows'] = [];
      const ends: number[] = [];
      for (const p of placed) {
        const row = ends.findIndex((e) => p.left + 0.05 >= e);
        if (row === -1) {
          rows.push([p]);
          ends.push(p.left + p.width);
        } else {
          rows[row].push(p);
          ends[row] = p.left + p.width;
        }
      }
      return { name, rows };
    };

    const lanes = [
      laneFor('Boards', (i) => hubKind(i.kind).group === 'boards'),
      laneFor('Skill', (i) => i.kind === 'sotw'),
      laneFor('Boss', (i) => i.kind === 'botw'),
      laneFor('Other', (i) => i.kind === 'eff'),
    ].filter((l) => l.rows.length > 0);

    // Weekly ticks close in, monthly when zoomed out — anything else is a picket fence.
    const stepMs = zoom <= 8 ? WEEK_MS : zoom <= 20 ? 2 * WEEK_MS : 4 * WEEK_MS;
    const ticks: { left: number; label: string }[] = [];
    for (let t = start; t <= end; t += stepMs) {
      ticks.push({
        left: pos(t),
        label: new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      });
    }

    return { lanes, ticks, nowLeft: pos(now), count: inWindow.length };
  }, [items, zoom, now, weeksAhead]);

  if (!view) {
    return <div className="h-40 rounded-xl border border-card-border bg-card-bg" aria-hidden />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted">{view.count} in view</span>
        <span className="ml-auto inline-flex overflow-hidden rounded-lg border border-card-border text-xs font-semibold">
          {ZOOMS.map((z) => (
            <button
              key={z.weeks}
              type="button"
              onClick={() => setZoom(z.weeks)}
              aria-pressed={zoom === z.weeks}
              className={`px-3 py-1.5 transition-colors ${
                zoom === z.weeks ? 'bg-gold text-brown-dark' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {z.label}
            </button>
          ))}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg p-4">
        <div ref={trackRef} className="relative min-w-[620px]">
          {/* axis */}
          <div className="relative h-4 border-b border-card-border">
            {view.ticks.map((t, i) => (
              <span key={i}>
                <span className="absolute inset-y-0 w-px bg-card-border/75" style={{ left: `${t.left}%` }} />
                <span
                  className="absolute top-0 whitespace-nowrap text-[10px] text-text-muted"
                  style={
                    t.left > 92
                      ? { left: `${t.left}%`, transform: 'translateX(calc(-100% - 4px))' }
                      : { left: `${t.left}%`, transform: 'translateX(4px)' }
                  }
                >
                  {t.label}
                </span>
              </span>
            ))}
          </div>

          {view.lanes.map((lane) => (
            <div key={lane.name} className="relative mt-6">
              <span className="absolute -top-4 left-0 text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                {lane.name}
              </span>
              <div style={{ height: lane.rows.length * (ROW_H + ROW_GAP) - ROW_GAP }} className="relative">
                {lane.rows.map((row, ri) =>
                  row.map(({ item, left, width }) => {
                    const meta = hubKind(item.kind);
                    const wide = (width / 100) * trackPx > 46;
                    return (
                      <ClanLink
                        key={item.key}
                        href={item.href}
                        onMouseEnter={(e) => setHover({ item, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover({ item, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHover(null)}
                        className={`absolute flex items-center gap-1.5 overflow-hidden rounded-md border px-1.5 text-[11px] font-bold transition-[filter] hover:brightness-125 ${
                          item.state === 'past' ? 'opacity-55' : ''
                        } ${item.state === 'upcoming' ? 'border-dashed' : ''}`}
                        style={{
                          left: `${left}%`,
                          width: `calc(${width}% - 3px)`,
                          top: ri * (ROW_H + ROW_GAP),
                          height: ROW_H,
                          borderColor: meta.accent,
                          color: meta.accent,
                          background:
                            item.state === 'upcoming'
                              ? 'transparent'
                              : `color-mix(in srgb, ${meta.accent} 24%, var(--brown-dark))`,
                        }}
                      >
                        <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: meta.accent }} />
                        {wide && <span className="truncate">{item.shortName}</span>}
                      </ClanLink>
                    );
                  }),
                )}
              </div>
            </div>
          ))}

          {/* today */}
          <span
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-gold shadow-[0_0_10px_rgba(212,160,23,0.7)]"
            style={{ left: `${view.nowLeft}%` }}
          >
            <span className="absolute -top-[3px] left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.1em] text-brown-dark">
              now
            </span>
          </span>
        </div>

        <div className="mt-4 flex min-w-[620px] flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-text-muted">
          {['classic', 'leagues', 'race', 'showdown', 'luckydraw', 'bounty', 'ladder', 'sotw', 'botw', 'eff'].map((k) => {
            const meta = hubKind(k as CalendarItem['kind']);
            return (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: meta.accent }} />
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-[250px] rounded-lg border border-card-border bg-brown-dark p-2.5 text-[11.5px] shadow-xl"
          style={{
            left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 260),
            top: hover.y + 16,
          }}
        >
          <b className="block text-[12.5px]">{hover.item.name}</b>
          <span className="text-text-muted">
            {hubKind(hover.item.kind).label} · {fmt(hover.item.start)} – {hover.item.openEnded ? 'open-ended' : fmt(hover.item.end)}
          </span>
          <span className="mt-1 block text-text-muted">
            {hover.item.state === 'live' ? '🔥 running now' : hover.item.state === 'upcoming' ? '⏳ scheduled' : '✓ finished'}
          </span>
        </div>
      )}
    </div>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
