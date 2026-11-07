// Live rows for the plugin panel's Feed tab (capability 'panel-rows'). A row is sent ONCE, by Postgres
// NOTIFY on 'anvil_push', to a room on the push socket (push/server.ts → ViewHub.deliverRows): a
// board, one team on it, or a list of people. The plugin appends it to every open list it names.
//
// Messages the plugin understands:
//   {t:'rows',     feeds:[id…], rows:[FeedRow…]}   grow these lists (newest first)
//   {t:'rowsdel',  feeds:[id…], ids:[rowId…]}      drop rows (a mod deleted a chat line; a run's old top row)
//   {t:'rowslock', feeds:[prefix…], locked}        grey a chat box out (paused / turned off), or null to reopen
//   {t:'rowsreact', feeds:[id…], id, gz, gold, sad, sit, who?, mine…?}  a row's reaction counts (lib/reactionPushWire)

import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, clans, completions, eventParticipants, events, moments, teams, tiles, users } from '@/db/schema';
import { atLeast } from '@/lib/clanRoles';
import { normalizeRsn } from '@/lib/auth';
import { supporterInksForRsns } from '@/lib/supporter';
import { inkForSurface } from '@/lib/supporterStyle';
import { log } from '@/lib/logger';
import { eventFeedFloor, isClanWorthy, panelFeedWorthy } from '@/lib/moments';
import { boardTileItemIds, clanScopeFor } from '@/lib/momentsStore';
import { completionFeedIds, completionRow, freshReacts, modeMomentFeedIds, momentFeedIds, momentRow, momentsFeedId, parseMomentsFeedId, rollupRow, type MomentLike } from '@/lib/pluginUi/feedUi';
import type { FeedRow } from '@/lib/pluginUi/nodes';
import { RUN_GAP_MS, runKey, stampMs, type RunInfo } from '@/lib/feedRuns';
import { standingsHidden } from '@/lib/standingsVisibility';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { ttlMemo } from '@/lib/ttlMemo';
import { NO_REACTIONS, reactionSummaries, reactorNames } from '@/lib/momentReactions';
import { reactPushMessage } from '@/lib/reactionPushWire';

/** NOTIFY payloads cap at 8000 bytes: this many ids leaves room for the row beside them. */
const IDS_PER_NOTIFY = 300;

export type RowsTarget = { e: number; t?: number } | { u: number[] };

/**
 * `playersReact`: the rows carry GZ / Sad / Sit chips, which only the board's players and its clan's
 * staff may use. They are all named (boardUserIds); the board's room also holds clanmates only
 * WATCHING it as their clan's home board, and the hub hands those the rows without the chips
 * (lib/push/hub deliverRows).
 */
export async function notifyRows(target: RowsTarget, m: Record<string, unknown>, opts: { playersReact?: boolean } = {}): Promise<void> {
  const rx = opts.playersReact ? { rx: 1 } : {};
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
    await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', ...target, ...(people.length ? { u: people } : {}), ...rx, m })})`);
    return;
  }
  await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', ...target, ...rx, m })})`);
  for (let i = 0; i < people.length; i += IDS_PER_NOTIFY) {
    await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'rows', u: people.slice(i, i + IDS_PER_NOTIFY), m })})`);
  }
}

/**
 * The logins seated on a board (one team's, with `teamId`): who reads its Feed from anywhere. A team's
 * list is read fresh every time: its rows are the team's secret while standings are hidden, and someone
 * just moved off the team must not hear the next one. The whole board's is held 15 seconds.
 */
function boardUserIds(eventId: number, teamId: number | null): Promise<number[]> {
  if (teamId != null) return readBoardUserIds(eventId, teamId);
  return ttlMemo(`panel-rows-board-users:${eventId}`, () => readBoardUserIds(eventId, null), 15_000);
}

async function readBoardUserIds(eventId: number, teamId: number | null): Promise<number[]> {
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

/**
 * The people on one team: team-only rows (team chat, a hidden-standings board's drops) go to them by
 * name, so they arrive on whichever of a player's boards it is — a ticket's team room covers only its
 * first board. Read fresh every time, never cached: someone just moved off the team must not hear it.
 */
export async function teamUserIds(teamId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ id: users.id })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(eq(eventParticipants.teamId, teamId));
  return rows.map((r) => r.id);
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

/** A clan's slug, for its Feed rows' reaction chips (views reactRowAct finds the clan by it). Held five minutes. */
function clanSlug(clanId: number): Promise<string | null> {
  return ttlMemo(
    `panel-rows-clan-slug:${clanId}`,
    async () => (await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { slug: true } }))?.slug ?? null,
    5 * 60_000,
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

/** A Supporter's name colours for a live row; none on any failure (flair is decoration). */
async function inkOf(rsn: string) {
  try {
    const ink = (await supporterInksForRsns([rsn])).get(normalizeRsn(rsn)) ?? null;
    return ink ? inkForSurface(ink, 'dark') : null;
  } catch {
    return null;
  }
}

/**
 * New moments, just stored: to the clan's Feed (member seats only, at the clan's floor) and the
 * board's (at the floor its size sets). Never throws — a missed live row is fixed by the next open.
 *
 * A moment that extends the run at the top of a list (lib/feedRuns: the same person dying again)
 * replaces that run's row: a `rowsdel` of the old top row, then the new row with the count, per list.
 * Sent oldest first, each judged as if the batch's later moments hadn't landed yet, so a batch of
 * deaths walks the count up the way the opened list would show it.
 */
export async function emitMomentRows(clanId: number, seatKind: string, list: NewMoment[], now = Date.now()): Promise<void> {
  if (!list.length) return;
  try {
    const ordered = [...list].sort((a, b) => (stampMs(a.occurredAt) || 0) - (stampMs(b.occurredAt) || 0));
    const later = (i: number) => new Set(ordered.slice(i + 1).map((x) => x.id));
    const scope = await clanScopeFor(clanId);
    if (seatKind === 'member') {
      const shown: { m: NewMoment; i: number }[] = [];
      const modeShown: NewMoment[] = [];
      for (const [i, m] of ordered.entries()) {
        if (m.worldMode) {
          modeShown.push(m);
          continue;
        }
        if (!isClanWorthy(m, scope) || !panelFeedWorthy(m, scope.minLootGp)) continue;
        // A drop filed on a board with hidden standings is that team's secret: not the clan's feed.
        if (m.eventId != null && (await boardHidden(m.eventId, now))) continue;
        shown.push({ m, i });
      }
      if (shown.length) {
        const ids = await clanUserIds(clanId);
        // Everyone named is a member seat, so every one of them may GZ (isClanMember): the chip goes on the row.
        const slug = await clanSlug(clanId);
        for (const { m, i } of shown) {
          const ink = await inkOf(m.rsn);
          const reacts = slug ? freshReacts({ slug }, m.id) : undefined;
          await sendMomentRow({ u: ids }, m, momentFeedIds({ kind: 'clan', id: clanId }, m.kind, null), (run) => momentRow({ ...m, run }, { ink, reacts }), later(i));
        }
      }
      if (modeShown.length) {
        const ids = await clanUserIds(clanId);
        const slug = await clanSlug(clanId);
        for (const m of modeShown) {
          const reacts = slug ? freshReacts({ slug }, m.id) : undefined;
          await notifyRows({ u: ids }, { t: 'rows', feeds: modeMomentFeedIds(clanId, m.kind, m.worldMode), rows: [momentRow(m, { ink: await inkOf(m.rsn), reacts })] });
        }
      }
    }
    for (const [i, m] of ordered.entries()) {
      if (m.worldMode) continue;
      if (m.eventId == null) continue;
      const floor = eventFeedFloor(await boardSize(m.eventId));
      // An item one of the board's tiles wants shows whatever it's worth.
      const wanted = m.itemId != null && (await boardTileItemIds(m.eventId)).has(m.itemId);
      if (!wanted && !panelFeedWorthy(m, floor)) {
        if (m.kind === 'unique' || m.kind === 'loot') await rollup(m.eventId, now);
        continue;
      }
      const team = m.teamId != null ? await teamOf(m.teamId) : null;
      const ink = await inkOf(m.rsn);
      const reacts = freshReacts({ e: m.eventId }, m.id);
      const build = (run?: RunInfo) => momentRow({ ...m, run }, { team, ink, reacts });
      // A board hiding its standings keeps each team's haul to the team.
      if (await boardHidden(m.eventId, now)) {
        if (m.teamId != null) {
          await sendMomentRow({ u: await teamUserIds(m.teamId) }, m, [`moments:event:${m.eventId}:team:${m.teamId}`], build, later(i));
        }
        continue;
      }
      await sendMomentRow({ e: m.eventId }, m, momentFeedIds({ kind: 'event', id: m.eventId }, m.kind, m.teamId), build, later(i), { playersReact: true });
    }
  } catch (err) {
    log.warn('panel-rows.emit-failed', { message: (err as Error).message });
  }
}

/**
 * One moment's live row to its lists. Where it extends the run at the top of a list, that list gets
 * the old top row deleted and the row with its count instead; lists can differ (a drop between two
 * deaths breaks the run in All, not in Deaths), so each outcome is its own pair of messages.
 */
async function sendMomentRow(
  target: RowsTarget,
  m: NewMoment,
  feeds: string[],
  build: (run?: RunInfo) => FeedRow,
  skip: ReadonlySet<number>,
  opts: { playersReact?: boolean } = {},
): Promise<void> {
  const plain = () => notifyRows(target, { t: 'rows', feeds, rows: [build()] }, opts);
  if (!(await mayExtendRun(m, skip))) return plain();
  const outcomes = new Map<string, { feeds: string[]; run?: RunInfo; del?: string }>();
  for (const feed of feeds) {
    const run = await topRunFor(feed, m.id, skip).catch(() => undefined);
    const del = run ? `m${run.ids[1]}` : undefined;
    const key = run ? `${del}|${run.n}|${run.mixed ? 1 : 0}` : '';
    const o = outcomes.get(key) ?? { feeds: [], run, del };
    o.feeds.push(feed);
    outcomes.set(key, o);
  }
  for (const o of outcomes.values()) {
    // The plugin drops a list's deleted ids before it adds new rows, in one flush.
    if (o.del) await notifyRows(target, { t: 'rowsdel', feeds: o.feeds, ids: [o.del] });
    await notifyRows(target, { t: 'rows', feeds: o.feeds, rows: [build(o.run)] }, opts);
  }
}

/**
 * Cheap first look before any list is read: could this moment be part of a run at all? The same
 * seat's same kind of moment within the run window. Most drops answer no on an index read.
 */
async function mayExtendRun(m: NewMoment, skip: ReadonlySet<number>): Promise<boolean> {
  if (m.id <= 0 || runKey(m) == null) return false;
  const at = stampMs(m.occurredAt);
  // clan-scope: global -- the seat of a moment this request just stored.
  const rows = await db.execute<{ id: number; occurred_at: string }>(sql`
    select b.id, b.occurred_at from moments a
    join moments b on b.clan_member_id = a.clan_member_id and b.kind = a.kind and b.id <> a.id
    where a.id = ${m.id}
    order by b.occurred_at desc limit 8`);
  const list = (rows as unknown as { rows?: { id: number; occurred_at: string }[] }).rows ?? (rows as unknown as { id: number; occurred_at: string }[]);
  return list.some((r) => !skip.has(Number(r.id)) && Math.abs(stampMs(r.occurred_at) - at) <= RUN_GAP_MS);
}

/**
 * The run at the top of one live list, when this moment heads it and it's two or more: what that
 * list's opened view (pluginUi/feedLists) would draw first, read without the batch's later moments.
 */
async function topRunFor(feed: string, momentId: number, skip: ReadonlySet<number>): Promise<RunInfo | undefined> {
  const f = parseMomentsFeedId(feed);
  if (!f) return undefined;
  // Imported here: feedLists reads this module's board helpers.
  const { clanFeedList, eventFeedList } = await import('@/lib/pluginUi/feedLists');
  const head =
    f.kind === 'clan'
      ? (await clanFeedList(f.id, f.filter, skip)).list[0]
      : (await eventFeedList(f.id, f.filter, f.teamId, skip)).items[0]?.m;
  return head && head.id === momentId && head.run && head.run.ids.length > 1 ? head.run : undefined;
}

/**
 * Who finished a completed tile: its recorded finisher (a stat or Solo tile), else whoever's submission
 * was the last one on it for that team, the one that took it over the line. Qualified by hand: Drizzle
 * renders a column in a correlated subquery unqualified.
 */
export const completionFinisher = sql<string | null>`coalesce(
  (select ep.name from event_participants ep where ep.id = "completions"."credit_player_id"),
  (select ep.name from submissions s join event_participants ep on ep.id = coalesce(s.credit_player_id, s.player_id)
     where s.tile_id = "completions"."tile_id" and s.team_id = "completions"."team_id" order by s.id desc limit 1)
)`;

/** A completion's stored timestamp as ISO (the column is 'YYYY-MM-DD HH:MM:SS' UTC). */
export function completionAt(stamp: string): string {
  return stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`;
}

/**
 * A team just finished a board tile: its row to the board's Feed (everything, Tiles, the team's).
 * A board hiding its standings tells only the team. A combo's part isn't a board cell, so it isn't
 * shown (its combo is, when it lands). Fire-and-forget: never throws, and a missed live row is back
 * the next time the list opens.
 */
export function emitCompletionRow(tileId: number, teamId: number): void {
  void (async () => {
    // clan-scope: global -- by the ids of a completion this request just stored.
    const [c] = await db
      .select({
        eventId: tiles.eventId,
        label: tiles.label,
        parent: tiles.parentTileId,
        revealedAt: tiles.revealedAt,
        mission: tiles.mission,
        tilesRevealed: events.tilesRevealed,
        rules: events.rules,
        at: completions.completedAt,
        who: completionFinisher,
      })
      .from(completions)
      .innerJoin(tiles, eq(tiles.id, completions.tileId))
      .innerJoin(events, eq(events.id, tiles.eventId))
      .where(and(eq(completions.tileId, tileId), eq(completions.teamId, teamId)))
      .limit(1);
    if (!c || c.parent != null || c.eventId == null) return;
    // Never name a tile members can't see yet (unrevealed board, scheduled reveal, unannounced mission).
    if (!c.tilesRevealed || !isTileRevealed(parseEventRules(c.rules), c)) return;
    const row = completionRow({ tileId, teamId, label: c.label, who: c.who ?? null, team: await teamOf(teamId), at: completionAt(c.at) });
    const target = (await boardHidden(c.eventId)) ? { e: c.eventId, t: teamId } : { e: c.eventId };
    await notifyRows(target, { t: 'rows', feeds: completionFeedIds(c.eventId, teamId), rows: [row] });
  })().catch((err: unknown) => log.warn('panel-rows.completion-failed', { tileId, teamId, message: (err as Error).message }));
}

/**
 * Somebody just gave or took back a reaction: the moment's counts, as they now stand, to every list its
 * live row went to (the same audiences emitMomentRows uses: the clan's members, the board's room or, on
 * a board hiding its standings, the team) — and first, with their own highlight, to the reactor's
 * clients, so their other client (another character, the same login) follows. Fire-and-forget: never
 * throws; a missed update is fixed when the list opens again.
 */
export function emitReactionRows(momentId: number, userId: number): void {
  void (async () => {
    // clan-scope: global -- the moment a reaction was just checked and stored against.
    const [m] = await db
      .select({
        kind: moments.kind,
        eventId: moments.eventId,
        teamId: moments.teamId,
        worldMode: moments.worldMode,
        clanId: clanMemberships.clanId,
        seat: clanMemberships.kind,
      })
      .from(moments)
      .innerJoin(clanMemberships, eq(clanMemberships.id, moments.clanMemberId))
      .where(eq(moments.id, momentId))
      .limit(1);
    if (!m) return;
    const summary = (await reactionSummaries([momentId], userId)).get(momentId) ?? NO_REACTIONS;
    const hidden = m.eventId != null && (await boardHidden(m.eventId));
    const send = async (target: RowsTarget, feeds: string[], who: Awaited<ReturnType<typeof reactorNames>>, opts: { playersReact?: boolean } = {}) => {
      const base = { feeds, momentId, momentKind: m.kind, summary, who: who.get(momentId) ?? {} };
      await notifyRows({ u: [userId] }, reactPushMessage({ ...base, mine: true }));
      await notifyRows(target, reactPushMessage(base), opts);
    };
    // The clan's Feed: a member's moment, unless a hidden board keeps it the team's.
    if (m.seat === 'member' && !hidden) {
      const feeds = m.worldMode ? modeMomentFeedIds(m.clanId, m.kind, m.worldMode) : momentFeedIds({ kind: 'clan', id: m.clanId }, m.kind, null);
      await send({ u: await clanUserIds(m.clanId) }, feeds, await reactorNames([momentId], { clanId: m.clanId }));
    }
    // The board's Feed (a separate-save moment is never on one).
    if (m.eventId != null && !m.worldMode) {
      // clan-scope: global -- the board this moment was filed on: its host clan names its reactors.
      const ev = await db.query.events.findFirst({ where: eq(events.id, m.eventId), columns: { clanId: true } });
      if (!ev) return;
      const who = await reactorNames([momentId], { eventId: m.eventId, hostClanId: ev.clanId });
      if (hidden) {
        if (m.teamId != null) await send({ u: await teamUserIds(m.teamId) }, [momentsFeedId({ kind: 'event', id: m.eventId }, 'team', m.teamId)], who);
      } else {
        await send({ e: m.eventId }, momentFeedIds({ kind: 'event', id: m.eventId }, m.kind, m.teamId), who, { playersReact: true });
      }
    }
  })().catch((err: unknown) => log.warn('panel-rows.reaction-failed', { momentId, message: (err as Error).message }));
}
