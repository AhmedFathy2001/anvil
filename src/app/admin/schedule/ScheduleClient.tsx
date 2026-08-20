'use client';

import { useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';
import {
  addDays,
  dayOf,
  daysBetween,
  findGaps,
  isoDay,
  laneRowsFor,
  packLanes,
  type Gap,
  type Laid,
} from '@/lib/scheduleLanes';

// One shape for boards and weeklies alike — see lib/eventIndex.
interface Item {
  kind: 'board' | 'weekly';
  id: number;
  title: string;
  badge: string;
  status: 'draft' | 'upcoming' | 'running' | 'ended';
  startDate: string;
  endDate: string;
  href: string;
  headline: string;
}

interface PrepStep {
  key: string;
  label: string;
  detail: string;
  state: 'done' | 'now' | 'todo';
}

type ViewMode = 'month' | 'quarter';

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function formatMonthYear(d: Date): string {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function shortDate(d: Date): string {
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
}

/** "in 3 days" / "in 4h" / "today" — the only number anyone reads off an upcoming event. */
function untilLabel(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return 'now';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `in ${hours}h`;
}

/* ---------------------------------------------------------------------------
   Colour. Status carries the meaning; kind is a shape (diamond vs circle), so
   a board and a weekly in the same state never rely on colour alone.
   --------------------------------------------------------------------------- */

function toneFor(item: Item): string {
  if (item.status === 'running') return 'bg-accent-green/15 text-accent-green-light border-accent-green/40';
  if (item.status === 'upcoming') {
    return item.kind === 'board'
      ? 'bg-gold/15 text-gold-light border-gold/40'
      : 'bg-blue-500/15 text-blue-300 border-blue-500/40';
  }
  return 'bg-text-muted/10 text-text-muted border-text-muted/30';
}

const STATUS_LABEL: Record<Item['status'], string> = {
  draft: 'no dates',
  upcoming: 'upcoming',
  running: 'running',
  ended: 'finished',
};

export default function ScheduleClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [unscheduled, setUnscheduled] = useState<Item[]>([]);
  const [prep, setPrep] = useState<{ key: string; steps: PrepStep[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [kinds, setKinds] = useState<{ board: boolean; weekly: boolean }>({ board: true, weekly: true });
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    clanFetch('/api/admin/schedule')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        setItems((data.items ?? []) as Item[]);
        setUnscheduled((data.unscheduled ?? []) as Item[]);
        setPrep((data.prep ?? null) as { key: string; steps: PrepStep[] } | null);
      })
      .finally(() => setLoading(false));
  }, []);

  // One reading of the clock for the page's lifetime — every "starts in 3 days" and every
  // today-marker agrees, and nothing shifts under a re-render.
  const [nowMs] = useState(() => Date.now());
  const today = useMemo(() => {
    const n = new Date(nowMs);
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, [nowMs]);

  const visible = useMemo(() => items.filter((i) => kinds[i.kind]), [items, kinds]);

  // The window each view reasons about: one month, or the cursor's month plus the two after it.
  const range = useMemo(() => {
    if (view === 'month') {
      const first = cursor;
      const start = addDays(first, -first.getDay());
      return { start, end: addDays(start, 41) };
    }
    return { start: cursor, end: addDays(addMonths(cursor, 3), -1) };
  }, [cursor, view]);

  const placed = useMemo(
    () => packLanes(visible, (i) => ({ start: dayOf(i.startDate), end: dayOf(i.endDate) })),
    [visible],
  );

  // A one-day seam between a competition closing and the next opening isn't a hole worth
  // reporting; two days of nothing is.
  const gaps = useMemo(
    () => findGaps(placed, range.start, range.end, 2),
    [placed, range],
  );

  // Only the gaps still ahead of us are worth acting on; a hole in the past is just history.
  const openGaps = useMemo(() => gaps.filter((g) => g.end >= today), [gaps, today]);

  const nextUp = useMemo(() => {
    return [...visible]
      .filter((i) => Date.parse(i.startDate) > nowMs)
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate))[0];
  }, [visible, nowMs]);

  const runningNow = useMemo(() => visible.filter((i) => i.status === 'running'), [visible]);

  const monthWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const days: Date[] = [];
      for (let d = 0; d < 7; d++) days.push(addDays(range.start, w * 7 + d));
      weeks.push(days);
    }
    return weeks;
  }, [range.start]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gold">Schedule</h1>
          <p className="text-text-muted text-sm mt-1">
            Boards and weekly competitions on one runway.
          </p>
        </div>
        <div className="flex gap-2">
          <ClanLink
            href="/admin/events/new"
            className="px-3 py-1.5 text-sm font-semibold bg-gold text-brown-dark rounded-lg hover:bg-gold-light transition-colors"
          >
            + Schedule event
          </ClanLink>
        </div>
      </div>

      <CoverageRibbon
        from={range.start}
        to={range.end}
        today={today}
        gaps={gaps}
        openGaps={openGaps}
        unscheduled={unscheduled}
      />

      {/* View switch, month nav, kind filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap mt-4 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex border border-card-border rounded-lg overflow-hidden bg-card-bg">
            {(['month', 'quarter'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === v ? 'bg-gold text-brown-dark' : 'text-text-muted hover:text-foreground hover:bg-card-bg-hover'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCursor(addMonths(cursor, -1))}
              className="px-2.5 py-1 text-sm border border-card-border rounded hover:border-gold/40 transition-colors"
              aria-label="Previous month"
            >
              &larr;
            </button>
            <span className="text-sm font-bold min-w-[128px] text-center">
              {view === 'month'
                ? formatMonthYear(cursor)
                : `${shortDate(cursor)} → ${shortDate(range.end)}`}
            </span>
            <button
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="px-2.5 py-1 text-sm border border-card-border rounded hover:border-gold/40 transition-colors"
              aria-label="Next month"
            >
              &rarr;
            </button>
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="px-2.5 py-1 text-sm border border-card-border rounded hover:border-gold/40 transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* The key doubles as the filter — there was never a reason for a legend you can't click. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <KindToggle
            on={kinds.board}
            onClick={() => setKinds((k) => ({ ...k, board: !k.board }))}
            label="Boards"
            swatch={<span className="w-2 h-2 bg-gold rotate-45 rounded-[1px]" />}
          />
          <KindToggle
            on={kinds.weekly}
            onClick={() => setKinds((k) => ({ ...k, weekly: !k.weekly }))}
            label="Weeklies"
            swatch={<span className="w-2 h-2 bg-blue-400 rounded-full" />}
          />
        </div>
      </div>

      {loading ? (
        <div className="border border-card-border rounded-xl bg-card-bg p-10 text-center text-sm text-text-muted">
          Loading the schedule…
        </div>
      ) : view === 'month' ? (
        <MonthGrid
          weeks={monthWeeks}
          cursor={cursor}
          today={today}
          placed={placed}
          expandedWeeks={expandedWeeks}
          onExpandWeek={(i) => setExpandedWeeks((e) => ({ ...e, [i]: true }))}
        />
      ) : (
        <QuarterGrid from={range.start} to={range.end} placed={placed} today={today} />
      )}

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <NextUp item={nextUp} prep={prep} nowMs={nowMs} runningNow={runningNow} />
        <Unscheduled items={unscheduled} openGaps={openGaps} />
      </div>
    </div>
  );
}

function KindToggle({
  on,
  onClick,
  label,
  swatch,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  swatch: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded-full border transition-colors ${
        on
          ? 'border-card-border bg-card-bg text-foreground'
          : 'border-transparent bg-transparent text-text-muted/50 line-through'
      }`}
    >
      <span className={on ? '' : 'opacity-40'}>{swatch}</span>
      {label}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Coverage — the answer to "is anything running, and where are the holes",
   before you read a single day cell.
   --------------------------------------------------------------------------- */

function CoverageRibbon({
  from,
  to,
  today,
  gaps,
  openGaps,
  unscheduled,
}: {
  from: Date;
  to: Date;
  today: Date;
  gaps: Gap[];
  openGaps: Gap[];
  unscheduled: Item[];
}) {
  const total = daysBetween(from, to) + 1;
  const segments: { left: number; width: number; gap: boolean }[] = [];
  const gapKeys = new Set<string>();
  for (const g of gaps) {
    for (let d = new Date(g.start); d <= g.end; d = addDays(d, 1)) gapKeys.add(isoDay(d));
  }
  let runStart = 0;
  let runGap = gapKeys.has(isoDay(from));
  for (let i = 1; i <= total; i++) {
    const day = addDays(from, i);
    const isGap = i < total ? gapKeys.has(isoDay(day)) : !runGap;
    if (isGap !== runGap || i === total) {
      segments.push({ left: (runStart / total) * 100, width: ((i - runStart) / total) * 100, gap: runGap });
      runStart = i;
      runGap = isGap;
    }
  }

  const todayPct = daysBetween(from, today) >= 0 && today <= to
    ? ((daysBetween(from, today) + 0.5) / total) * 100
    : null;

  const worst = openGaps[0];

  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70">
          Coverage · {shortDate(from)} → {shortDate(to)}
        </div>
        <div className="relative h-2.5 rounded-full bg-brown-dark overflow-hidden mt-2 flex">
          {segments.map((s, i) => (
            <span
              key={i}
              className={s.gap ? 'bg-yellow-500/25' : 'bg-accent-green/60'}
              style={{ width: `${s.width}%` }}
            />
          ))}
          {todayPct != null && (
            <span
              className="absolute top-0 bottom-0 w-px bg-gold"
              style={{ left: `${todayPct}%` }}
              aria-hidden
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-text-muted/70 mt-1.5">
          <span>{shortDate(from)}</span>
          <span className="text-gold">today</span>
          <span>{shortDate(to)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        {worst ? (
          <>
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 whitespace-nowrap">
              {/* A gap running to the edge of the view has no honest length — only a start. */}
              {worst.openEnded
                ? `⚠ Nothing scheduled after ${shortDate(addDays(worst.start, -1))}`
                : `⚠ ${worst.days} empty day${worst.days === 1 ? '' : 's'} · ${shortDate(worst.start)}–${shortDate(worst.end)}`}
            </span>
            <ClanLink
              href={
                unscheduled.length > 0
                  ? unscheduled[0].href
                  : `/admin/events/new?start=${isoDay(worst.start)}&end=${isoDay(worst.end)}`
              }
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gold text-brown-dark hover:bg-gold-light transition-colors whitespace-nowrap"
            >
              {unscheduled.length > 0 ? `Schedule ${unscheduled[0].title}` : 'Fill the gap'}
            </ClanLink>
          </>
        ) : (
          <span className="text-xs px-2 py-1 rounded-full bg-accent-green/15 text-accent-green-light border border-accent-green/30">
            Nothing runs dry in this window
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Month — one bar per event, spanning its days.
   --------------------------------------------------------------------------- */

const MAX_LANES = 4;

function MonthGrid({
  weeks,
  cursor,
  today,
  placed,
  expandedWeeks,
  onExpandWeek,
}: {
  weeks: Date[][];
  cursor: Date;
  today: Date;
  placed: Laid<Item>[];
  expandedWeeks: Record<number, boolean>;
  onExpandWeek: (i: number) => void;
}) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-card-border bg-brown-dark/40">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[10px] uppercase tracking-[0.12em] text-text-muted/70"
            >
              {d}
            </div>
          ))}
        </div>

        {weeks.map((days, wi) => {
          const weekStart = days[0];
          const weekEnd = days[6];
          const inWeek = placed.filter((p) => p.start <= weekEnd && weekStart <= p.end);

          // Lanes are global so bars don't jump rows mid-event, but a week that only uses
          // lanes 0 and 5 shouldn't render four empty rows — compact the lanes it actually
          // uses, keeping their order.
          const expanded = expandedWeeks[wi];
          const laneRow = laneRowsFor(inWeek, expanded ? Infinity : MAX_LANES);
          const shownLanes = [...laneRow.keys()];
          const hiddenCount = inWeek.filter((p) => !laneRow.has(p.lane)).length;

          // The absolute lane overlay can't push the day cells open, so the week is sized from the
          // lanes it draws: header + one row each + room for the "+N more". Floored, so a quiet
          // month still reads as a calendar instead of collapsing to a row of numbers.
          const height = Math.max(76, 30 + shownLanes.length * 26 + (hiddenCount > 0 ? 16 : 0) + 8);

          return (
            <div key={wi} className="relative border-b border-card-border/60 last:border-b-0">
              <div className="grid grid-cols-7" style={{ minHeight: `${height}px` }}>
                {days.map((day, di) => {
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const isToday = sameDay(day, today);
                  return (
                    <div
                      key={di}
                      className={`group relative border-r border-card-border/60 last:border-r-0 px-2 pt-1.5 ${
                        inMonth ? '' : 'bg-brown-dark/40'
                      } ${isToday ? 'bg-gold/[0.045]' : ''}`}
                    >
                      <span
                        className={
                          isToday
                            ? 'inline-grid place-items-center w-5 h-5 rounded-full bg-gold text-brown-dark text-[11px] font-bold'
                            : `text-[11px] ${inMonth ? 'text-text-muted' : 'text-text-muted/40'}`
                        }
                      >
                        {day.getDate()}
                      </span>
                      <ClanLink
                        href={`/admin/events/new?start=${isoDay(day)}`}
                        aria-label={`Schedule something on ${shortDate(day)}`}
                        className="absolute top-1 right-1.5 w-[18px] h-[18px] rounded border border-card-border text-text-muted/70 text-[11px] leading-none grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:border-gold/40 hover:text-gold hover:bg-gold/10 transition-opacity"
                      >
                        +
                      </ClanLink>
                    </div>
                  );
                })}
              </div>

              {/* Lane overlay: one absolutely-placed bar per event per week. */}
              <div
                className="absolute inset-x-0 grid grid-cols-7 gap-y-1 pointer-events-none"
                style={{ top: '28px' }}
              >
                {inWeek
                  .filter((p) => laneRow.has(p.lane))
                  .map((p) => {
                    const from = p.start > weekStart ? p.start : weekStart;
                    const to = p.end < weekEnd ? p.end : weekEnd;
                    const col = daysBetween(weekStart, from) + 1;
                    const span = daysBetween(from, to) + 1;
                    const cutLeft = p.start < weekStart;
                    const cutRight = p.end > weekEnd;
                    return (
                      <ClanLink
                        key={`${p.item.kind}-${p.item.id}`}
                        href={p.item.href}
                        title={`${p.item.title} · ${p.item.badge} · ${shortDate(p.start)} → ${shortDate(p.end)} · ${p.item.headline}`}
                        style={{
                          gridColumn: `${col} / span ${span}`,
                          gridRow: `${(laneRow.get(p.lane) ?? 0) + 1}`,
                        }}
                        className={`pointer-events-auto h-[22px] flex items-center gap-1.5 px-2 text-[10px] font-semibold whitespace-nowrap overflow-hidden border transition-[filter] hover:brightness-125 ${toneFor(
                          p.item,
                        )} ${
                          cutLeft ? 'rounded-l-none border-l-dashed ml-0' : 'rounded-l-md ml-[3px]'
                        } ${cutRight ? 'rounded-r-none border-r-dashed mr-0' : 'rounded-r-md mr-[3px]'}`}
                      >
                        <span
                          className={`shrink-0 w-[6px] h-[6px] bg-current ${
                            p.item.kind === 'board' ? 'rotate-45 rounded-[1px]' : 'rounded-full'
                          }`}
                          aria-hidden
                        />
                        <span className="truncate">{p.item.title}</span>
                        {span >= 4 && (
                          <span className="ml-auto opacity-60 font-normal hidden sm:inline">
                            {p.item.headline}
                          </span>
                        )}
                      </ClanLink>
                    );
                  })}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => onExpandWeek(wi)}
                    style={{ gridColumn: '1 / span 7', gridRow: `${shownLanes.length + 1}` }}
                    className="pointer-events-auto text-left text-[10px] text-text-muted hover:text-gold pl-2"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Quarter — the same bars over three months, one row per event. This is the
   view that answers "what does the season look like".
   --------------------------------------------------------------------------- */

function QuarterGrid({
  from,
  to,
  placed,
  today,
}: {
  from: Date;
  to: Date;
  placed: Laid<Item>[];
  today: Date;
}) {
  const total = daysBetween(from, to) + 1;
  const rows = [...placed].sort((a, b) => a.start.getTime() - b.start.getTime());

  // A tick at the start of each week that begins inside the window.
  const ticks: Date[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 7)) ticks.push(new Date(d));

  const todayPct = today >= from && today <= to ? (daysBetween(from, today) / total) * 100 : null;

  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4 overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[180px_1fr] gap-3 items-end">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70">
            {formatMonthYear(from)} → {formatMonthYear(to)}
          </div>
          <div className="relative flex border-b border-card-border/60 pb-1.5">
            {ticks.map((t, i) => (
              <span
                key={i}
                className="text-[9px] text-text-muted/70 shrink-0"
                style={{ width: `${(7 / total) * 100}%` }}
              >
                {shortDate(t)}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mt-2 space-y-1">
          {rows.length === 0 && (
            <p className="text-sm text-text-muted py-6 text-center">Nothing scheduled in this window.</p>
          )}
          {rows.map((p) => {
            const left = (daysBetween(from, p.start) / total) * 100;
            const width = ((daysBetween(p.start, p.end) + 1) / total) * 100;
            return (
              <div key={`${p.item.kind}-${p.item.id}`} className="grid grid-cols-[180px_1fr] gap-3 items-center">
                <ClanLink
                  href={p.item.href}
                  className="text-[11px] text-text-muted hover:text-foreground truncate flex items-center gap-2"
                >
                  <span
                    className={`shrink-0 w-[6px] h-[6px] ${
                      p.item.kind === 'board' ? 'rotate-45 rounded-[1px] bg-gold' : 'rounded-full bg-blue-400'
                    }`}
                    aria-hidden
                  />
                  {p.item.title}
                </ClanLink>
                <div className="relative h-6">
                  <ClanLink
                    href={p.item.href}
                    title={`${shortDate(p.start)} → ${shortDate(p.end)} · ${p.item.headline}`}
                    style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }}
                    className={`absolute inset-y-0 my-auto h-[22px] rounded-md border flex items-center px-2 text-[10px] font-semibold overflow-hidden whitespace-nowrap hover:brightness-125 transition-[filter] ${toneFor(
                      p.item,
                    )}`}
                  >
                    <span className="truncate">
                      {p.item.headline} · {STATUS_LABEL[p.item.status]}
                    </span>
                  </ClanLink>
                </div>
              </div>
            );
          })}
          {todayPct != null && rows.length > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-gold/60 pointer-events-none"
              style={{ left: `calc(180px + 0.75rem + ${todayPct}%)` }}
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Next up — the countdown, and what still has to happen before it starts.
   --------------------------------------------------------------------------- */

function NextUp({
  item,
  prep,
  nowMs,
  runningNow,
}: {
  item: Item | undefined;
  prep: { key: string; steps: PrepStep[] } | null;
  nowMs: number;
  runningNow: Item[];
}) {
  const steps = item && prep?.key === `${item.kind}-${item.id}` ? prep.steps : null;
  const outstanding = steps?.filter((s) => s.state !== 'done') ?? [];

  return (
    <section>
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Before the next one starts
      </h2>

      {!item ? (
        <div className="border border-dashed border-card-border rounded-xl p-6 text-center text-sm text-text-muted">
          {runningNow.length > 0
            ? `${runningNow.length} running now, nothing queued behind it.`
            : 'Nothing scheduled ahead.'}{' '}
          <ClanLink href="/admin/events/new" className="text-gold hover:underline">
            Schedule one →
          </ClanLink>
        </div>
      ) : (
        <div className="border border-gold/30 rounded-xl bg-card-bg p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <ClanLink href={item.href} className="font-semibold hover:text-gold transition-colors">
                {item.title}
              </ClanLink>
              <div className="text-xs text-text-muted mt-1">
                {item.badge} · {item.headline} · starts {shortDate(dayOf(item.startDate))}
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-gold/15 text-gold border border-gold/30 whitespace-nowrap">
              {untilLabel(new Date(item.startDate), new Date(nowMs))}
            </span>
          </div>

          {steps ? (
            <ul className="mt-4 space-y-2">
              {steps.map((s) => (
                <li key={s.key} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`w-4 h-4 shrink-0 rounded grid place-items-center text-[9px] border ${
                      s.state === 'done'
                        ? 'bg-accent-green/15 border-accent-green/40 text-accent-green-light'
                        : s.state === 'now'
                          ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400'
                          : 'bg-brown-light border-card-border text-text-muted'
                    }`}
                  >
                    {s.state === 'done' ? '✓' : '!'}
                  </span>
                  <span className={s.state === 'done' ? 'text-text-muted' : ''}>{s.label}</span>
                  <span className="text-xs text-text-muted/70 ml-auto">{s.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-muted mt-3">
              Weekly competitions roll on their own — nothing to prepare.
            </p>
          )}

          {outstanding.length > 0 && (
            <ClanLink
              href={item.href}
              className="inline-block mt-4 px-3 py-1.5 text-xs font-semibold bg-gold text-brown-dark rounded-lg hover:bg-gold-light transition-colors"
            >
              {outstanding.length} thing{outstanding.length === 1 ? '' : 's'} left → open it
            </ClanLink>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Unscheduled — boards that exist but have no dates. These are what a gap is
   usually waiting for, so they sit next to it rather than being filtered out.
   --------------------------------------------------------------------------- */

function Unscheduled({
  items,
  openGaps,
}: {
  items: Item[];
  openGaps: Gap[];
}) {
  return (
    <section>
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-yellow-500 rounded-full" />
        Waiting for dates
        {items.length > 0 && (
          <span className="text-xs text-text-muted font-normal">{items.length}</span>
        )}
      </h2>

      {items.length === 0 ? (
        <div className="border border-dashed border-card-border rounded-xl p-6 text-center text-sm text-text-muted">
          Every board has dates.
        </div>
      ) : (
        <ul className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
          {items.map((it) => (
            <li key={`${it.kind}-${it.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <ClanLink href={it.href} className="text-sm font-medium hover:text-gold transition-colors">
                  {it.title}
                </ClanLink>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {it.badge} · {it.headline}
                </div>
              </div>
              <ClanLink
                href={
                  openGaps[0]
                    ? `${it.href}?start=${isoDay(openGaps[0].start)}&end=${isoDay(openGaps[0].end)}`
                    : it.href
                }
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-card-border hover:border-gold/40 hover:text-gold transition-colors whitespace-nowrap"
              >
                {openGaps[0] ? `Put it in the ${openGaps[0].days}-day gap` : 'Set dates'}
              </ClanLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
