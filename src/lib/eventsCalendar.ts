import { db } from '@/db';
import { clans, eventCohosts, events, weeklyCompetitions } from '@/db/schema';
import { and, eq, gte, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { modeKeyFor } from '@/lib/eventModes';
import { BOSSES, EFFICIENCY_LABELS, SKILL_LABELS } from '@/lib/constants';
import type { HubKind } from '@/lib/eventsHub';

/**
 * Every competition on one time axis.
 *
 * This is the argument for the merge made visible: a three-week bingo runs straight through three
 * Skill weeks, a ladder runs across the whole month, and until they are drawn together nobody can
 * see the shape of a clan's season. It reads out of `start_date`/`end_date` on both tables — no new
 * columns, no new tracking.
 *
 * DELIBERATELY LIGHT. The calendar wants a year of bars, which is more competitions than any page
 * would ever card or list — so it takes no aggregates at all: no leaders, no entrant counts, no
 * completions. A bar is a name, a kind and a span, and everything heavier is one click away on the
 * competition's own page. That is what makes a year affordable.
 */

export interface CalendarItem {
  key: string;
  kind: HubKind;
  name: string;
  /** What fits on a bar. The accent already says the kind, so the bar only needs the part that
      differs — the metric, or the board's name without its category prefix. */
  shortName: string;
  href: string;
  /** ISO. `end` is the window's edge for an open-ended run, flagged by `openEnded`. */
  start: string;
  end: string;
  openEnded: boolean;
  state: 'live' | 'upcoming' | 'past';
}

export interface CalendarWindow {
  /** ISO bounds of everything loaded — the widest zoom the client can offer without refetching. */
  from: string;
  to: string;
}

const WEEK_MS = 7 * 86_400_000;

/**
 * @param weeksBack  how far into the archive the widest zoom reaches
 * @param weeksAhead how far past today, so what's scheduled is always in frame
 */
export async function loadCalendar(
  clanId: number,
  weeksBack = 52,
  weeksAhead = 3,
  now: Date = new Date(),
): Promise<{ items: CalendarItem[]; window: CalendarWindow }> {
  const to = new Date(now.getTime() + weeksAhead * WEEK_MS).toISOString();
  const from = new Date(now.getTime() - weeksBack * WEEK_MS).toISOString();
  const nowIso = now.toISOString();

  // Events this clan CO-HOSTS belong on its calendar too, linking across to the host's URL.
  const cohosted = await db
    .select({ eventId: eventCohosts.eventId, hostSlug: clans.slug })
    .from(eventCohosts)
    .innerJoin(events, eq(events.id, eventCohosts.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(and(eq(eventCohosts.clanId, clanId), eq(eventCohosts.status, 'accepted')));
  const hostSlugByEvent = new Map(cohosted.map((c) => [c.eventId, c.hostSlug]));
  const cohostedIds = cohosted.map((c) => c.eventId);

  const [boardRows, weekRows] = await Promise.all([
    db
      .select({
        id: events.id,
        clanId: events.clanId,
        name: events.name,
        startDate: events.startDate,
        endDate: events.endDate,
        forceEndedAt: events.forceEndedAt,
        format: events.format,
        scoringMode: events.scoringMode,
        rules: events.rules,
      })
      .from(events)
      .where(
        and(
          cohostedIds.length ? or(eq(events.clanId, clanId), inArray(events.id, cohostedIds)) : eq(events.clanId, clanId),
          // A draft has no start date: it isn't scheduled, so it isn't on a calendar.
          isNotNull(events.startDate),
          lte(events.startDate, to),
          // An open-ended run (no end date) is still going, so it always overlaps.
          or(isNull(events.endDate), gte(events.endDate, from)),
        ),
      ),
    db
      .select({
        id: weeklyCompetitions.id,
        title: weeklyCompetitions.title,
        startDate: weeklyCompetitions.startDate,
        endDate: weeklyCompetitions.endDate,
        status: weeklyCompetitions.status,
        type: weeklyCompetitions.type,
        metric: weeklyCompetitions.metric,
      })
      .from(weeklyCompetitions)
      .where(
        and(
          eq(weeklyCompetitions.clanId, clanId),
          lte(weeklyCompetitions.startDate, to),
          gte(weeklyCompetitions.endDate, from),
        ),
      ),
  ]);

  const items: CalendarItem[] = [];

  for (const b of boardRows) {
    const start = b.startDate!;
    const ended = !!b.forceEndedAt || (!!b.endDate && b.endDate < nowIso);
    const state: CalendarItem['state'] = ended ? 'past' : start > nowIso ? 'upcoming' : 'live';
    items.push({
      key: `e${b.id}`,
      kind: modeKeyFor(b.format, b.scoringMode, b.rules),
      name: b.name,
      shortName: b.name.replace(/^Tile Race: /, '').replace(/^The Ladder — /, ''),
      href: b.clanId === clanId ? `/events/${b.id}` : `/c/${hostSlugByEvent.get(b.id) ?? ''}/events/${b.id}`,
      start,
      // Open-ended and force-ended runs still need a right edge to draw to.
      end: b.forceEndedAt ?? b.endDate ?? (state === 'past' ? nowIso : to),
      openEnded: !b.endDate && !b.forceEndedAt,
      state,
    });
  }

  const WEEK_KIND: Record<string, HubKind> = { skill: 'sotw', boss: 'botw', efficiency: 'eff' };
  for (const w of weekRows) {
    items.push({
      key: `w${w.id}`,
      kind: WEEK_KIND[w.type] ?? 'sotw',
      name: w.title,
      shortName: weeklyMetricLabel(w.type, w.metric),
      href: `/weekly/${w.id}`,
      start: w.startDate,
      end: w.endDate,
      openEnded: false,
      state: w.status === 'active' ? 'live' : w.status === 'upcoming' ? 'upcoming' : 'past',
    });
  }

  return { items, window: { from, to } };
}

function weeklyMetricLabel(type: string, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] ?? metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] ?? metric.toUpperCase();
  return BOSSES.find((b) => b.key === metric)?.label ?? metric;
}
