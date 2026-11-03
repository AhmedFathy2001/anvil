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
import { accounts, clanMemberships, eventParticipants, events, teams, users } from '@/db/schema';
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
  await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', ...target, m })})`);
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

/** Whether a board's standings are behind the curtain now. Held a minute. */
function boardHidden(eventId: number, now: number): Promise<boolean> {
  return ttlMemo(
    `panel-rows-board-hidden:${eventId}`,
    async () => {
      // clan-scope: this clan -- by id, for a moment its own board just recorded
      const ev = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { startDate: true, endDate: true, forceEndedAt: true, rules: true },
      });
      return ev ? standingsHidden(ev, now) : false;
    },
    60_000,
  );
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
      const shown = list.filter((m) => isClanWorthy(m, scope) && panelFeedWorthy(m, scope.minLootGp));
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

