// Live rows for the plugin panel's Feed tab (capability 'panel-rows'). A row is sent ONCE, by Postgres
// NOTIFY on 'anvil_push', to a room on the push socket (push/server.ts → ViewHub.deliverRows): a
// board, one team on it, or a list of people. The plugin appends it to every open list it names.
//
// Messages the plugin understands:
//   {t:'rows',     feeds:[id…], rows:[FeedRow…]}   grow these lists (newest first)
//   {t:'rowsdel',  feeds:[id…], ids:[rowId…]}      drop rows (a mod deleted a chat line)
//   {t:'rowslock', feeds:[prefix…], locked}        grey a chat box out (paused / turned off), or null to reopen

import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, eventParticipants, events, teams, users } from '@/db/schema';
import { atLeast } from '@/lib/clanRoles';
import { log } from '@/lib/logger';
import { eventFeedFloor, isClanWorthy, panelFeedWorthy } from '@/lib/moments';
import { clanScopeFor } from '@/lib/momentsStore';
import { momentFeedIds, momentRow, rollupRow, type MomentLike } from '@/lib/pluginUi/feedUi';
import { standingsHidden } from '@/lib/standingsVisibility';
import { ttlMemo } from '@/lib/ttlMemo';

/** NOTIFY payloads cap at 8000 bytes: this many ids leaves room for the row beside them. */
const IDS_PER_NOTIFY = 300;

export type RowsTarget = { e: number; t?: number } | { u: number[] };

export async function notifyRows(target: RowsTarget, m: Record<string, unknown>): Promise<void> {
  if ('u' in target) {
    for (let i = 0; i < target.u.length; i += IDS_PER_NOTIFY) {
      await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', u: target.u.slice(i, i + IDS_PER_NOTIFY), m })})`);
    }
    return;
  }
  // A board's room holds only the plugins whose ACTIVE board this is. Someone reading it from the Feed
  // dropdown (another board they're on) isn't in it, so the board's people are named too; the hub
  // sends once per plugin within a notice, so nobody in both gets a row twice.
  const people = await boardUserIds(target.e, target.t ?? null);
  if (people.length <= IDS_PER_NOTIFY) {
    await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', ...target, ...(people.length ? { u: people } : {}), m })})`);
    return;
  }
  await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', ...target, m })})`);
  for (let i = 0; i < people.length; i += IDS_PER_NOTIFY) {
    await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', u: people.slice(i, i + IDS_PER_NOTIFY), m })})`);
  }
}

/** The logins seated on a board (one team's, with `teamId`): who reads its Feed from anywhere. Held a minute. */
function boardUserIds(eventId: number, teamId: number | null): Promise<number[]> {
  return ttlMemo(
    `panel-rows-board-users:${eventId}:${teamId ?? 'all'}`,
    async () => {
      // clan-scope: global -- by the board id a row is being sent for.
      const rows = await db
        .selectDistinct({ id: users.id })
        .from(eventParticipants)
        .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
        .innerJoin(users, eq(users.playerId, accounts.playerId))
        .where(
          teamId != null
            ? and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId))
            : eq(eventParticipants.eventId, eventId),
        );
      const ids = new Set(rows.map((r) => r.id));
      // The whole board's rows also reach its clan's moderators and up: they read and moderate its chat
      // without a seat on it. A team's rows stay the team's.
      if (teamId == null) {
        const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { clanId: true } });
        if (ev) {
          const staff = await db.select({ userId: clanStaff.userId, role: clanStaff.role }).from(clanStaff).where(eq(clanStaff.clanId, ev.clanId));
          for (const st of staff) if (atLeast(st.role, 'moderator')) ids.add(st.userId);
        }
      }
      return [...ids];
    },
    60_000,
  );
}

/** The people with a live member seat in a clan: who hears its Feed. Held a minute. */
function clanUserIds(clanId: number): Promise<number[]> {
  return ttlMemo(
    `panel-rows-clan-users:${clanId}`,
    async () => {
      const rows = await db
        .selectDistinct({ id: users.id })
        .from(clanMemberships)
        .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
        .innerJoin(users, eq(users.playerId, accounts.playerId))
        .where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
      return rows.map((r) => r.id);
    },
    60_000,
  );
}

/** A board's player count, for its floor. Held five minutes. */
export function boardSize(eventId: number): Promise<number> {
  return ttlMemo(
    `panel-rows-board-size:${eventId}`,
    async () => {
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(eventParticipants).where(eq(eventParticipants.eventId, eventId));
      return r?.n ?? 0;
    },
    5 * 60_000,
  );
}

/**
 * Whether a board's standings are behind the curtain now. Read fresh every time, never cached: a host
 * who hides standings mid-event must not leak a minute of other teams' drops.
 */
export async function boardHidden(eventId: number, now: number = Date.now()): Promise<boolean> {
  // clan-scope: this clan -- by id, for a moment its own board just recorded
  const ev = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { startDate: true, endDate: true, forceEndedAt: true, rules: true },
  });
  return ev ? standingsHidden(ev, now) : false;
}

function teamOf(teamId: number): Promise<{ name: string; color: string | null } | null> {
  return ttlMemo(
    `panel-rows-team:${teamId}`,
    async () => (await db.query.teams.findFirst({ where: eq(teams.id, teamId), columns: { name: true, color: true } })) ?? null,
    5 * 60_000,
  );
}

// What a big board's floor kept out, counted per board and said once a minute.
const held = new Map<number, { n: number; since: number }>();
const ROLLUP_EVERY_MS = 60_000;

async function rollup(eventId: number, now: number): Promise<void> {
  const h = held.get(eventId) ?? { n: 0, since: now };
  h.n++;
  held.set(eventId, h);
  if (now - h.since < ROLLUP_EVERY_MS) return;
  held.delete(eventId);
  const at = new Date(now).toISOString();
  await notifyRows({ e: eventId }, { t: 'rows', feeds: [`moments:event:${eventId}`, `moments:event:${eventId}:drops`], rows: [rollupRow(eventId, h.n, at)] });
}

export interface NewMoment extends MomentLike {
  eventId: number | null;
  tier: string | null;
  kc: number | null;
}

/**
 * New moments, just stored: to the clan's Feed (member seats only, at the clan's floor) and the
 * board's (at the floor its size sets). Never throws — a missed live row is fixed by the next open.
 */
export async function emitMomentRows(clanId: number, seatKind: string, list: NewMoment[], now = Date.now()): Promise<void> {
  if (!list.length) return;
  try {
    const scope = await clanScopeFor(clanId);
    if (seatKind === 'member') {
      const shown: NewMoment[] = [];
      for (const m of list) {
        if (!isClanWorthy(m, scope) || !panelFeedWorthy(m, scope.minLootGp)) continue;
        // A drop filed on a board with hidden standings is that team's secret: not the clan's feed.
        if (m.eventId != null && (await boardHidden(m.eventId, now))) continue;
        shown.push(m);
      }
      if (shown.length) {
        const ids = await clanUserIds(clanId);
        for (const m of shown) {
          await notifyRows({ u: ids }, { t: 'rows', feeds: momentFeedIds({ kind: 'clan', id: clanId }, m.kind, null), rows: [momentRow(m)] });
        }
      }
    }
    for (const m of list) {
      if (m.eventId == null) continue;
      const floor = eventFeedFloor(await boardSize(m.eventId));
      if (!panelFeedWorthy(m, floor)) {
        if (m.kind === 'unique' || m.kind === 'loot') await rollup(m.eventId, now);
        continue;
      }
      const team = m.teamId != null ? await teamOf(m.teamId) : null;
      const row = momentRow(m, { team });
      // A board hiding its standings keeps each team's haul to the team.
      if (await boardHidden(m.eventId, now)) {
        if (m.teamId != null) {
          await notifyRows({ e: m.eventId, t: m.teamId }, { t: 'rows', feeds: [`moments:event:${m.eventId}:team:${m.teamId}`], rows: [row] });
        }
        continue;
      }
      await notifyRows({ e: m.eventId }, { t: 'rows', feeds: momentFeedIds({ kind: 'event', id: m.eventId }, m.kind, m.teamId), rows: [row] });
    }
  } catch (err) {
    log.warn('panel-rows.emit-failed', { message: (err as Error).message });
  }
}

