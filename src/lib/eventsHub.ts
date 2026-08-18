import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { and, count, eq } from 'drizzle-orm';
import { countPastEvents, loadEventCards, type EventCard } from '@/lib/eventCards';
import { loadWeeklyCards, type WeeklyCard, type WeeklyKind } from '@/lib/weeklyCards';
import type { EventMode } from '@/lib/eventModes';

/**
 * The Events hub, assembled once.
 *
 * A Skill of the Week has a start, an end, entrants, a leaderboard and a winner. It is an event by
 * every definition this site already uses, and the only reason it lived on a separate page was that
 * it lives in a separate table. So this joins the two at the read layer, and nothing below cares
 * which table a competition came from.
 *
 * Two rules the surfaces above depend on:
 *
 *   1. SEVERAL OF EACH CAN BE LIVE. A clan runs two bingos and three weeklies in the same week and
 *      every one of them is the point of the page. Nothing here reduces "what's live" to one of
 *      anything, and boards and weeks are peers — same card, same billing.
 *   2. WHAT'S RUNNING IS NEVER PAGED; the archive always is. Live and upcoming come back whole; the
 *      record comes back a page at a time, newest first, because a clan two years in has hundreds
 *      of finished competitions and no page needs them all at once.
 */

export type HubKind = EventMode | WeeklyKind;

/** One line of the record, from either table. */
export interface HubItem {
  /** Unique across both tables — the id alone is not. */
  key: string;
  id: number;
  kind: HubKind;
  group: 'boards' | 'weeks';
  name: string;
  href: string;
  startDate: string | null;
  endDate: string | null;
  state: 'live' | 'upcoming' | 'past';
  entrants: number;
  entrantLabel: string;
  /** Winner once finished, leader while it runs. */
  top: { name: string; text: string; color?: string } | null;
}

export interface HubView {
  live: { boards: EventCard[]; weeks: WeeklyCard[] };
  upcoming: { boards: EventCard[]; weeks: WeeklyCard[] };
  record: {
    items: HubItem[];
    /** Everything finished, both tables — the count the filters quote. */
    pastTotal: number;
    boardsTotal: number;
    weeksTotal: number;
  };
}

export interface LoadHubOptions {
  /** How many finished competitions the record shows. Live and upcoming ignore it. */
  pastLimit?: number;
}

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));

/** The number a week is won by, written the way that metric is read. */
export function weeklyValueText(unit: string, value: number): string {
  if (unit === 'h') return `${(value / 1000).toFixed(1)}h`;
  if (unit === 'KC') return `${Math.round(value).toLocaleString()} KC`;
  return `${short(value)} XP`;
}

function boardItem(e: EventCard): HubItem {
  return {
    key: `e${e.id}`,
    id: e.id,
    kind: e.mode,
    group: 'boards',
    name: e.name,
    href: `/events/${e.id}`,
    startDate: e.startDate,
    endDate: e.endDate,
    state: e.status,
    // The chips already say "4 teams" / "41 players"; the number itself is what the ledger wants.
    entrants: Number(e.chips[0]?.match(/^(\d+)/)?.[1] ?? 0),
    entrantLabel: e.chips[0]?.includes('player') ? 'players' : 'teams',
    top: e.top ? { name: e.top.name, text: `${e.top.score.toLocaleString()} ${e.top.unit}`, color: e.top.color } : null,
  };
}

function weekItem(w: WeeklyCard): HubItem {
  return {
    key: `w${w.id}`,
    id: w.id,
    kind: w.kind,
    group: 'weeks',
    name: w.name,
    href: `/weekly/${w.id}`,
    startDate: w.startDate,
    endDate: w.endDate,
    state: w.state,
    entrants: w.entrants,
    entrantLabel: 'entered',
    top: w.top ? { name: w.top.rsn, text: weeklyValueText(w.unit, w.top.value) } : null,
  };
}

export async function loadHubView(clanId: number, opts: LoadHubOptions = {}, now: Date = new Date()): Promise<HubView> {
  const pastLimit = opts.pastLimit ?? 24;

  // Each side is asked for a page of finished items; merging then trimming gives the newest
  // `pastLimit` across BOTH without reading either archive whole.
  const [boards, weeks, boardsPast, weeksPast] = await Promise.all([
    loadEventCards(clanId, { includeUpcoming: true, pastLimit }, now),
    loadWeeklyCards(clanId, { pastLimit, withDailyShape: true }, now),
    countPastEvents(clanId, now),
    db
      .select({ c: count() })
      .from(weeklyCompetitions)
      .where(and(eq(weeklyCompetitions.clanId, clanId), eq(weeklyCompetitions.status, 'completed')))
      .then((r) => r[0]?.c ?? 0),
  ]);

  const items = [...boards.map(boardItem), ...weeks.map(weekItem)]
    .filter((i) => i.state === 'past')
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
    .slice(0, pastLimit);

  return {
    live: {
      boards: boards.filter((b) => b.status === 'live'),
      weeks: weeks.filter((w) => w.state === 'live'),
    },
    upcoming: {
      boards: boards.filter((b) => b.status === 'upcoming'),
      weeks: weeks.filter((w) => w.state === 'upcoming'),
    },
    record: { items, pastTotal: boardsPast + weeksPast, boardsTotal: boardsPast, weeksTotal: weeksPast },
  };
}
