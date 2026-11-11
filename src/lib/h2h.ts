// Head-to-head challenges: the database half (rules in lib/h2hRules).
//
// SIGNALS — no new plugin code, the same ones a bingo tile reads:
//   • kc / xp: the account's effective stats, max(hiscores snapshot, the plugin's live push), the
//     exact reading a stat tile scores off (lib/statTracking computeGain). The plugin pushes every
//     skill's XP and every boss KC whatever is being watched, and the hiscores sweep fills in for a
//     player without it. The start line is the effective snapshot at acceptance.
//   • drop: the plugin's moment reports (POST /api/plugin/moments): a 'drop' for the item id, or a
//     live 'clog' unlock by name. The plugin reports any drop whose id is in the config's
//     `luckItemIds` whatever it sells for, so /api/plugin/config adds the ids of the character's
//     live drop races there (h2hDropItemIdsForAccount).
//
// Settled by the per-minute cron (settleDueH2h) and whenever either side's list is read; a drop race
// finishes the moment the first qualifying drop arrives.
//
// BRAGGING RIGHTS ONLY: see lib/h2hRules. Nothing here moves gp, items or money.

import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, accountStatSnapshots, clanMemberships, clans, h2hChallenges, h2hPrefs, users } from '@/db/schema';
import { sendChallengesWebhook } from '@/lib/discord';
import { normalizeRsn } from '@/lib/auth';
import { discordRest, sharedBotToken } from '@/lib/discord-roles';
import {
  type H2hKind,
  type H2hResult,
  type H2hStatus,
  type H2hTarget,
  MAX_CREATED_PER_DAY,
  OPEN_STATUSES,
  RESPOND_WINDOW_MS,
  decideByDrop,
  decideByScore,
  describe,
  dropCounts,
  h2hCap,
  isPublic,
  recordFor,
  resultSentence,
  underCap,
  type H2hRecord,
} from '@/lib/h2hRules';
import { log } from '@/lib/logger';
import { parsePluginStats } from '@/lib/pluginStats';
import { isPreview } from '@/lib/platformSettings';
import { absoluteUrl } from '@/lib/seo';
import { computeGainFromJson, effectiveSnapshotJson } from '@/lib/statTracking';
import { supporterForPlayer } from '@/lib/supporter';
import { queueH2hHighlight } from '@/lib/highlights/store';

type Row = typeof h2hChallenges.$inferSelect;

/** A settle running this late after the end uses the last scores read in time, not today's. */
const LATE_SETTLE_MS = 10 * 60_000;

// ── Characters ───────────────────────────────────────────────────────────────────────────────────

export interface H2hCharacter {
  accountId: number;
  playerId: number;
  rsn: string;
}

/**
 * A character that can take part: PROVEN to belong to a person (verified, not on the watchlist), and
 * that person has signed in to Anvil at least once — somebody has to be able to press Accept.
 */
export async function eligibleCharacter(rsn: string): Promise<H2hCharacter | null> {
  const key = normalizeRsn(rsn);
  if (!key || key.length > 12) return null;
  const acct = await db.query.accounts.findFirst({
    where: eq(accounts.rsnNormalized, key),
    columns: { id: true, playerId: true, rsn: true, verifiedAt: true, provisional: true, status: true },
  });
  if (!acct || !acct.verifiedAt || acct.provisional !== 0 || acct.status === 'banned') return null;
  const login = await db.query.users.findFirst({ where: eq(users.playerId, acct.playerId), columns: { id: true, banned: true } });
  if (!login || login.banned) return null;
  return { accountId: acct.id, playerId: acct.playerId, rsn: acct.rsn };
}

/** The person's own characters that can take part (verified). */
export async function myH2hCharacters(playerId: number): Promise<H2hCharacter[]> {
  const rows = await db
    .select({ id: accounts.id, rsn: accounts.rsn, verifiedAt: accounts.verifiedAt, provisional: accounts.provisional })
    .from(accounts)
    .where(eq(accounts.playerId, playerId));
  return rows
    .filter((r) => r.verifiedAt && r.provisional === 0)
    .map((r) => ({ accountId: r.id, playerId, rsn: r.rsn }))
    .sort((a, b) => a.rsn.localeCompare(b.rsn));
}

// ── Caps and prefs ───────────────────────────────────────────────────────────────────────────────

/** Open (pending + active) challenges a person holds, on either side. */
export async function openCount(playerId: number, excludeId?: number): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(h2hChallenges)
    .where(
      and(
        or(eq(h2hChallenges.challengerPlayerId, playerId), eq(h2hChallenges.opponentPlayerId, playerId)),
        inArray(h2hChallenges.status, [...OPEN_STATUSES]),
        excludeId ? sql`${h2hChallenges.id} <> ${excludeId}` : undefined,
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function capForPlayer(playerId: number): Promise<number | null> {
  const s = await supporterForPlayer(playerId).catch(() => null);
  return h2hCap(s?.tier.id ?? null);
}

export interface H2hPrefs {
  closed: boolean;
  blocked: number[];
}

function parseBlocked(raw: string | null | undefined): number[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500) : [];
  } catch {
    return [];
  }
}

export async function getH2hPrefs(playerId: number): Promise<H2hPrefs> {
  const row = await db.query.h2hPrefs.findFirst({ where: eq(h2hPrefs.playerId, playerId) });
  return { closed: row?.closed ?? false, blocked: parseBlocked(row?.blocked) };
}

export async function setH2hPrefs(playerId: number, prefs: Partial<H2hPrefs>): Promise<H2hPrefs> {
  const cur = await getH2hPrefs(playerId);
  const next: H2hPrefs = {
    closed: typeof prefs.closed === 'boolean' ? prefs.closed : cur.closed,
    blocked: prefs.blocked ? [...new Set(prefs.blocked.filter((n) => Number.isInteger(n) && n > 0 && n !== playerId))].slice(0, 500) : cur.blocked,
  };
  await db
    .insert(h2hPrefs)
    .values({ playerId, closed: next.closed, blocked: JSON.stringify(next.blocked) })
    .onConflictDoUpdate({ target: h2hPrefs.playerId, set: { closed: next.closed, blocked: JSON.stringify(next.blocked), updatedAt: new Date() } });
  return next;
}

/** Block a person: every open invitation from them is declined too. */
export async function blockPlayer(playerId: number, blockedPlayerId: number): Promise<void> {
  const prefs = await getH2hPrefs(playerId);
  await setH2hPrefs(playerId, { blocked: [...prefs.blocked, blockedPlayerId] });
  await db
    .update(h2hChallenges)
    .set({ status: 'declined', finishedAt: new Date() })
    .where(
      and(
        eq(h2hChallenges.status, 'pending'),
        eq(h2hChallenges.opponentPlayerId, playerId),
        eq(h2hChallenges.challengerPlayerId, blockedPlayerId),
      ),
    );
}

// ── Create, answer, cancel ───────────────────────────────────────────────────────────────────────

export type H2hOutcome = { ok: true; id: number } | { ok: false; error: string; status?: number };

/** Drop races keep their item names beside the ids, so a name-only log unlock can be matched. */
interface DropItem {
  i: number;
  n: string;
}

function parseItems(raw: string | null | undefined): DropItem[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && Number.isInteger(x.i)).map((x) => ({ i: x.i, n: String(x.n ?? '') })) : [];
  } catch {
    return [];
  }
}

export async function createChallenge(args: {
  playerId: number;
  userId: number | null;
  /** The challenger's own character. */
  accountId: number;
  opponentRsn: string;
  target: H2hTarget;
  /** drop races: each id's name. */
  itemNames?: Map<number, string>;
  /** The challenger's say on showing the result publicly. */
  public?: boolean;
  now?: Date;
}): Promise<H2hOutcome> {
  const now = args.now ?? new Date();
  const mine = (await myH2hCharacters(args.playerId)).find((c) => c.accountId === args.accountId);
  if (!mine) return { ok: false, error: 'Pick one of your own verified characters to play as.' };
  const them = await eligibleCharacter(args.opponentRsn);
  if (!them) {
    return { ok: false, error: 'That player isn’t on Anvil with a verified character yet. They need to sign in and connect the plugin first.', status: 404 };
  }
  // Same person on both sides — your own alt, or the same character twice — is not a challenge.
  if (them.playerId === args.playerId) return { ok: false, error: 'You can’t challenge yourself or your own characters.' };

  const prefs = await getH2hPrefs(them.playerId);
  // Said the same way for "closed" and "blocked you": a block must not be readable from outside.
  if (prefs.closed || prefs.blocked.includes(args.playerId)) return { ok: false, error: `${them.rsn} isn’t taking challenges right now.` };

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [{ n: today }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(h2hChallenges)
    .where(and(eq(h2hChallenges.challengerPlayerId, args.playerId), gte(h2hChallenges.createdAt, dayAgo)));
  if (today >= MAX_CREATED_PER_DAY) return { ok: false, error: 'That’s a lot of challenges for one day. Try again tomorrow.', status: 429 };

  const pendingPair = await db
    .select({ id: h2hChallenges.id })
    .from(h2hChallenges)
    .where(
      and(
        eq(h2hChallenges.status, 'pending'),
        or(
          and(eq(h2hChallenges.challengerPlayerId, args.playerId), eq(h2hChallenges.opponentPlayerId, them.playerId)),
          and(eq(h2hChallenges.challengerPlayerId, them.playerId), eq(h2hChallenges.opponentPlayerId, args.playerId)),
        ),
      ),
    )
    .limit(1);
  if (pendingPair.length) return { ok: false, error: `There’s already an open invitation between you and ${them.rsn}.` };

  const cap = await capForPlayer(args.playerId);
  if (!underCap(await openCount(args.playerId), cap)) {
    return { ok: false, error: `You have ${cap} open challenge${cap === 1 ? '' : 's'}, your limit. Finish one first, or go Supporter for more.`, status: 403 };
  }

  const items: DropItem[] = args.target.itemIds.map((i) => ({ i, n: args.itemNames?.get(i) ?? '' }));
  const [row] = await db
    .insert(h2hChallenges)
    .values({
      kind: args.target.kind,
      statKey: args.target.statKey,
      itemIds: args.target.kind === 'drop' ? JSON.stringify(items) : null,
      label: args.target.label,
      durationMin: args.target.durationMin,
      challengerPlayerId: args.playerId,
      challengerAccountId: mine.accountId,
      challengerUserId: args.userId,
      opponentPlayerId: them.playerId,
      opponentAccountId: them.accountId,
      status: 'pending',
      createdAt: now,
      respondBy: new Date(now.getTime() + RESPOND_WINDOW_MS),
      challengerPublic: !!args.public,
    })
    .returning({ id: h2hChallenges.id });

  const sentence = describe(args.target.kind, args.target.label, args.target.durationMin);
  void tellPerson(them.playerId, `${mine.rsn} challenged you: ${sentence}. Accept or decline on Anvil.`, 'info', {
    dm: `**${mine.rsn}** challenged you on Anvil: ${sentence}.\nJust for bragging rights. Accept or decline within 24 hours: ${absoluteUrl('/challenges')}`,
  });
  return { ok: true, id: row.id };
}

async function loadRow(id: number): Promise<Row | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return (await db.query.h2hChallenges.findFirst({ where: eq(h2hChallenges.id, id) })) ?? null;
}

/** The opponent answers. Accepting snapshots both start lines and starts the clock. */
export async function respondToChallenge(args: {
  id: number;
  playerId: number;
  accept: boolean;
  public?: boolean;
  now?: Date;
}): Promise<H2hOutcome> {
  const now = args.now ?? new Date();
  const row = await loadRow(args.id);
  if (!row || row.opponentPlayerId !== args.playerId) return { ok: false, error: 'No such invitation.', status: 404 };
  if (row.status !== 'pending') return { ok: false, error: 'That invitation was already answered.' };
  if (row.respondBy.getTime() <= now.getTime()) {
    await db.update(h2hChallenges).set({ status: 'expired', finishedAt: now }).where(and(eq(h2hChallenges.id, row.id), eq(h2hChallenges.status, 'pending')));
    return { ok: false, error: 'That invitation expired.' };
  }
  const names = await rsnsOf([row.challengerAccountId, row.opponentAccountId]);
  const theirName = names.get(row.opponentAccountId) ?? 'They';

  if (!args.accept) {
    await db.update(h2hChallenges).set({ status: 'declined', finishedAt: now }).where(and(eq(h2hChallenges.id, row.id), eq(h2hChallenges.status, 'pending')));
    void tellPerson(row.challengerPlayerId, `${theirName} declined your challenge (${row.label}).`, 'info');
    return { ok: true, id: row.id };
  }

  // Both sides' caps, now: the opponent's slot is taken only by accepting.
  const cap = await capForPlayer(args.playerId);
  if (!underCap(await openCount(args.playerId, row.id), cap)) {
    return { ok: false, error: `You already have ${cap} open challenge${cap === 1 ? '' : 's'}, your limit. Finish one first, or go Supporter for more.`, status: 403 };
  }

  let challengerBaseline: string | null = null;
  let opponentBaseline: string | null = null;
  if (row.kind !== 'drop') {
    const read = await readings([row.challengerAccountId, row.opponentAccountId]);
    challengerBaseline = baselineOf(read.get(row.challengerAccountId));
    opponentBaseline = baselineOf(read.get(row.opponentAccountId));
  }
  const updated = await db
    .update(h2hChallenges)
    .set({
      status: 'active',
      startedAt: now,
      endsAt: new Date(now.getTime() + row.durationMin * 60_000),
      challengerBaseline,
      opponentBaseline,
      opponentPublic: !!args.public,
    })
    .where(and(eq(h2hChallenges.id, row.id), eq(h2hChallenges.status, 'pending')))
    .returning({ id: h2hChallenges.id });
  if (!updated.length) return { ok: false, error: 'That invitation was already answered.' };
  void tellPerson(row.challengerPlayerId, `${theirName} accepted: ${describe(row.kind as H2hKind, row.label, row.durationMin)}. Go!`, 'near');
  if (isPublic({ challengerPublic: row.challengerPublic, opponentPublic: !!args.public })) {
    void postToClans(row, 'start').catch((err) => log.warn('h2h.clan-post-failed', { id: row.id, message: (err as Error).message }));
  }
  return { ok: true, id: row.id };
}

/**
 * Cancel. Before acceptance the challenger may withdraw (the opponent declines instead). Once it is
 * running it takes both: the first asks, the other agrees by asking too.
 */
export async function cancelChallenge(args: { id: number; playerId: number; now?: Date }): Promise<H2hOutcome & { waiting?: boolean }> {
  const now = args.now ?? new Date();
  const row = await loadRow(args.id);
  const side = row ? sideOf(row, args.playerId) : null;
  if (!row || !side) return { ok: false, error: 'No such challenge.', status: 404 };
  if (row.status === 'pending') {
    if (side !== 'challenger') return { ok: false, error: 'Decline it instead.' };
    await db.update(h2hChallenges).set({ status: 'cancelled', finishedAt: now }).where(and(eq(h2hChallenges.id, row.id), eq(h2hChallenges.status, 'pending')));
    return { ok: true, id: row.id };
  }
  if (row.status !== 'active') return { ok: false, error: 'That challenge is already over.' };
  const otherPlayer = side === 'challenger' ? row.opponentPlayerId : row.challengerPlayerId;
  if (row.cancelRequestedBy === otherPlayer) {
    await db.update(h2hChallenges).set({ status: 'cancelled', finishedAt: now }).where(and(eq(h2hChallenges.id, row.id), eq(h2hChallenges.status, 'active')));
    void tellPerson(otherPlayer, `Your challenge (${row.label}) was called off by agreement.`, 'info');
    return { ok: true, id: row.id };
  }
  await db.update(h2hChallenges).set({ cancelRequestedBy: args.playerId }).where(and(eq(h2hChallenges.id, row.id), eq(h2hChallenges.status, 'active')));
  const names = await rsnsOf([side === 'challenger' ? row.challengerAccountId : row.opponentAccountId]);
  void tellPerson(otherPlayer, `${[...names.values()][0] ?? 'Your opponent'} asked to call off your challenge (${row.label}). Agree on Anvil to cancel it.`, 'info');
  return { ok: true, id: row.id, waiting: true };
}

/** One side's say on showing the result publicly. */
export async function setChallengePublic(args: { id: number; playerId: number; on: boolean }): Promise<H2hOutcome> {
  const row = await loadRow(args.id);
  const side = row ? sideOf(row, args.playerId) : null;
  if (!row || !side) return { ok: false, error: 'No such challenge.', status: 404 };
  await db
    .update(h2hChallenges)
    .set(side === 'challenger' ? { challengerPublic: args.on } : { opponentPublic: args.on })
    .where(eq(h2hChallenges.id, row.id));
  return { ok: true, id: row.id };
}

function sideOf(row: Pick<Row, 'challengerPlayerId' | 'opponentPlayerId'>, playerId: number): 'challenger' | 'opponent' | null {
  return row.challengerPlayerId === playerId ? 'challenger' : row.opponentPlayerId === playerId ? 'opponent' : null;
}

// ── Readings and scores ──────────────────────────────────────────────────────────────────────────

interface Reading {
  snapshot: string | null;
  live: Record<string, number>;
}

async function readings(accountIds: number[]): Promise<Map<number, Reading>> {
  const ids = [...new Set(accountIds)];
  const out = new Map<number, Reading>();
  if (!ids.length) return out;
  const rows = await db
    .select({ id: accounts.id, live: accounts.liveStats, snapshot: accountStatSnapshots.snapshot })
    .from(accounts)
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(inArray(accounts.id, ids));
  for (const r of rows) out.set(r.id, { snapshot: r.snapshot ?? null, live: parsePluginStats(r.live) });
  return out;
}

/** The start line: the hiscores snapshot raised by the live push. Null with no snapshot at all. */
function baselineOf(r: Reading | undefined): string | null {
  if (!r) return null;
  return effectiveSnapshotJson(r.snapshot, null, r.live);
}

function gainOf(row: Pick<Row, 'kind' | 'statKey'>, baseline: string | null, r: Reading | undefined): number {
  if (!baseline || !r || !row.statKey) return 0;
  return computeGainFromJson(baseline, r.snapshot, r.live, [row.statKey], row.kind === 'xp' ? 'skill' : 'boss');
}

/**
 * Refresh the scores of running kc/xp challenges, capture a start line that could not be read at
 * acceptance (no snapshot yet: it starts counting from the first one, never from zero), and finish
 * whatever is due. Returns the ids it finished.
 */
async function refreshAndSettle(rows: Row[], now: Date): Promise<number[]> {
  const finished: number[] = [];
  const nowMs = now.getTime();
  const stat = rows.filter((r) => r.status === 'active' && r.kind !== 'drop');
  const read = await readings(stat.flatMap((r) => [r.challengerAccountId, r.opponentAccountId]));
  for (const r of rows) {
    if (r.status === 'pending' && r.respondBy.getTime() <= nowMs) {
      await db.update(h2hChallenges).set({ status: 'expired', finishedAt: now }).where(and(eq(h2hChallenges.id, r.id), eq(h2hChallenges.status, 'pending')));
      r.status = 'expired';
      continue;
    }
    if (r.status !== 'active' || !r.endsAt) continue;
    const endsMs = r.endsAt.getTime();
    const due = nowMs >= endsMs;

    if (r.kind === 'drop') {
      if (due) {
        const result = decideByDrop(r.challengerHitAt?.getTime() ?? null, r.opponentHitAt?.getTime() ?? null, true);
        if (await finish(r, result ?? 'tie', now)) finished.push(r.id);
      }
      continue;
    }

    // Too late to trust a fresh read as "at the end": keep what was read in time.
    const fresh = !due || nowMs - endsMs <= LATE_SETTLE_MS;
    const set: Partial<Row> = {};
    if (fresh) {
      const a = read.get(r.challengerAccountId);
      const b = read.get(r.opponentAccountId);
      if (!r.challengerBaseline && !due) set.challengerBaseline = r.challengerBaseline = baselineOf(a);
      if (!r.opponentBaseline && !due) set.opponentBaseline = r.opponentBaseline = baselineOf(b);
      const sa = gainOf(r, r.challengerBaseline, a);
      const sb = gainOf(r, r.opponentBaseline, b);
      // Scores only ever rise: a hiscores read lagging the live push must not take kills back.
      if (sa > r.challengerScore) set.challengerScore = r.challengerScore = sa;
      if (sb > r.opponentScore) set.opponentScore = r.opponentScore = sb;
    }
    if (Object.keys(set).length) {
      await db.update(h2hChallenges).set(set).where(and(eq(h2hChallenges.id, r.id), eq(h2hChallenges.status, 'active')));
    }
    if (due && (await finish(r, decideByScore(r.challengerScore, r.opponentScore), now))) finished.push(r.id);
  }
  return finished;
}

/** Close one challenge with its result, once (a second settle finds it finished and stops). */
async function finish(r: Row, result: H2hResult, now: Date): Promise<boolean> {
  const done = await db
    .update(h2hChallenges)
    .set({ status: 'finished', result, finishedAt: now, challengerScore: r.challengerScore, opponentScore: r.opponentScore })
    .where(and(eq(h2hChallenges.id, r.id), eq(h2hChallenges.status, 'active')))
    .returning({ id: h2hChallenges.id });
  if (!done.length) return false;
  r.status = 'finished';
  r.result = result;
  r.finishedAt = now;
  await announceResult(r).catch((err) => log.warn('h2h.announce-failed', { id: r.id, message: (err as Error).message }));
  // A public win by someone playing a streamed event is clipped on their live channel (lib/highlights).
  queueH2hHighlight(r);
  return true;
}

/** The cron: expire lapsed invitations, refresh running kc/xp scores, finish what is due. */
export async function settleDueH2h(now = new Date()): Promise<number> {
  const rows = await db
    .select()
    .from(h2hChallenges)
    .where(
      or(
        and(eq(h2hChallenges.status, 'pending'), lte(h2hChallenges.respondBy, now)),
        and(eq(h2hChallenges.status, 'active'), or(lte(h2hChallenges.endsAt, now), sql`${h2hChallenges.kind} <> 'drop'`)),
      ),
    )
    .limit(2000);
  return (await refreshAndSettle(rows, now)).length;
}

// ── Drops ────────────────────────────────────────────────────────────────────────────────────────

/** Item ids the plugin should report for this character: its running drop races. */
export async function h2hDropItemIdsForAccount(accountId: number): Promise<number[]> {
  const rows = await db
    .select({ itemIds: h2hChallenges.itemIds })
    .from(h2hChallenges)
    .where(
      and(
        eq(h2hChallenges.status, 'active'),
        eq(h2hChallenges.kind, 'drop'),
        or(eq(h2hChallenges.challengerAccountId, accountId), eq(h2hChallenges.opponentAccountId, accountId)),
      ),
    );
  return [...new Set(rows.flatMap((r) => parseItems(r.itemIds).map((x) => x.i)))].sort((a, b) => a - b);
}

export interface ReportedDrop {
  itemId: number | null;
  itemName: string | null;
  /** ISO, already clamped to "not in the future, not over a day old" by the moments route. */
  occurredAt: string;
}

const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * A character reported drops (or live log unlocks): mark any of its running drop races they win, and
 * finish them. Returns how many races ended.
 */
export async function recordH2hDrops(accountId: number, drops: ReportedDrop[], now = new Date()): Promise<number> {
  if (!drops.length) return 0;
  const rows = await db
    .select()
    .from(h2hChallenges)
    .where(
      and(
        eq(h2hChallenges.status, 'active'),
        eq(h2hChallenges.kind, 'drop'),
        or(eq(h2hChallenges.challengerAccountId, accountId), eq(h2hChallenges.opponentAccountId, accountId)),
      ),
    );
  let ended = 0;
  for (const r of rows) {
    const items = parseItems(r.itemIds);
    const ids = new Set(items.map((x) => x.i));
    const names = new Set(items.map((x) => nameKey(x.n)).filter(Boolean));
    const startMs = r.startedAt?.getTime() ?? null;
    const endMs = r.endsAt?.getTime() ?? null;
    let first: number | null = null;
    for (const d of drops) {
      const hit = (d.itemId != null && ids.has(d.itemId)) || (d.itemId == null && !!d.itemName && names.has(nameKey(d.itemName)));
      const at = Date.parse(d.occurredAt);
      if (!hit || !dropCounts(at, startMs, endMs)) continue;
      if (first == null || at < first) first = at;
    }
    if (first == null) continue;
    const side = r.challengerAccountId === accountId ? 'challenger' : 'opponent';
    const prev = side === 'challenger' ? r.challengerHitAt : r.opponentHitAt;
    if (prev && prev.getTime() <= first) continue;
    const at = new Date(first);
    await db
      .update(h2hChallenges)
      .set(side === 'challenger' ? { challengerHitAt: at } : { opponentHitAt: at })
      .where(and(eq(h2hChallenges.id, r.id), eq(h2hChallenges.status, 'active')));
    if (side === 'challenger') r.challengerHitAt = at;
    else r.opponentHitAt = at;
    const result = decideByDrop(r.challengerHitAt?.getTime() ?? null, r.opponentHitAt?.getTime() ?? null, false);
    if (result && (await finish(r, result, now))) ended++;
  }
  return ended;
}

// ── Reading for the page, the profile and the panel ─────────────────────────────────────────────

export interface H2hView {
  id: number;
  kind: H2hKind;
  label: string;
  sentence: string;
  status: H2hStatus;
  durationMin: number;
  side: 'challenger' | 'opponent';
  me: { rsn: string; score: number; hitAt: string | null };
  them: { rsn: string; playerId: number; score: number; hitAt: string | null };
  createdAt: string;
  respondBy: string;
  startedAt: string | null;
  endsAt: string | null;
  finishedAt: string | null;
  /** From this person's side. */
  outcome: 'won' | 'lost' | 'tie' | null;
  resultLine: string | null;
  myPublic: boolean;
  isPublic: boolean;
  cancelAsked: 'me' | 'them' | null;
  itemIds: number[];
  statKey: string | null;
}

async function rsnsOf(accountIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(accountIds)];
  if (!ids.length) return new Map();
  const rows = await db.select({ id: accounts.id, rsn: accounts.rsn }).from(accounts).where(inArray(accounts.id, ids));
  return new Map(rows.map((r) => [r.id, r.rsn]));
}

function viewOf(r: Row, playerId: number, names: Map<number, string>): H2hView {
  const side = sideOf(r, playerId) ?? 'challenger';
  const mine = side === 'challenger';
  const myAcct = mine ? r.challengerAccountId : r.opponentAccountId;
  const theirAcct = mine ? r.opponentAccountId : r.challengerAccountId;
  const result = (r.result as H2hResult | null) ?? null;
  const outcome = !result ? null : result === 'tie' ? 'tie' : result === side ? 'won' : 'lost';
  const challengerName = names.get(r.challengerAccountId) ?? '?';
  const opponentName = names.get(r.opponentAccountId) ?? '?';
  return {
    id: r.id,
    kind: r.kind as H2hKind,
    label: r.label,
    sentence: describe(r.kind as H2hKind, r.label, r.durationMin),
    status: r.status as H2hStatus,
    durationMin: r.durationMin,
    side,
    me: { rsn: names.get(myAcct) ?? '?', score: mine ? r.challengerScore : r.opponentScore, hitAt: (mine ? r.challengerHitAt : r.opponentHitAt)?.toISOString() ?? null },
    them: {
      rsn: names.get(theirAcct) ?? '?',
      playerId: mine ? r.opponentPlayerId : r.challengerPlayerId,
      score: mine ? r.opponentScore : r.challengerScore,
      hitAt: (mine ? r.opponentHitAt : r.challengerHitAt)?.toISOString() ?? null,
    },
    createdAt: r.createdAt.toISOString(),
    respondBy: r.respondBy.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    endsAt: r.endsAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
    outcome,
    resultLine: result
      ? resultSentence(r.kind as H2hKind, r.label, result, { challenger: challengerName, opponent: opponentName }, r.kind === 'drop' ? undefined : { challenger: r.challengerScore, opponent: r.opponentScore })
      : null,
    myPublic: mine ? r.challengerPublic : r.opponentPublic,
    isPublic: isPublic(r),
    cancelAsked: r.cancelRequestedBy == null ? null : r.cancelRequestedBy === playerId ? 'me' : 'them',
    itemIds: parseItems(r.itemIds).map((x) => x.i),
    statKey: r.statKey,
  };
}

/** Everything a person is in: open first (refreshed and settled on the way), then recent history. */
export async function challengesForPlayer(playerId: number, opts: { now?: Date; historyLimit?: number } = {}): Promise<H2hView[]> {
  const now = opts.now ?? new Date();
  const mine = or(eq(h2hChallenges.challengerPlayerId, playerId), eq(h2hChallenges.opponentPlayerId, playerId));
  const open = await db.select().from(h2hChallenges).where(and(mine, inArray(h2hChallenges.status, [...OPEN_STATUSES])));
  await refreshAndSettle(open, now);
  const history = await db
    .select()
    .from(h2hChallenges)
    .where(and(mine, inArray(h2hChallenges.status, ['finished', 'declined', 'expired', 'cancelled'])))
    .orderBy(sql`${h2hChallenges.finishedAt} desc nulls last`)
    .limit(opts.historyLimit ?? 30);
  const all = [...open.filter((r) => r.status === 'pending' || r.status === 'active'), ...history];
  const seen = new Set<number>();
  const rows = all.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  const names = await rsnsOf(rows.flatMap((r) => [r.challengerAccountId, r.opponentAccountId]));
  return rows.map((r) => viewOf(r, playerId, names));
}

/** Open challenges for one character, for the plugin panel. */
export async function challengesForAccount(accountId: number, now = new Date()): Promise<H2hView[]> {
  const acct = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId), columns: { playerId: true } });
  if (!acct) return [];
  const rows = await db
    .select()
    .from(h2hChallenges)
    .where(
      and(
        or(eq(h2hChallenges.challengerAccountId, accountId), eq(h2hChallenges.opponentAccountId, accountId)),
        inArray(h2hChallenges.status, [...OPEN_STATUSES]),
      ),
    );
  await refreshAndSettle(rows, now);
  const live = rows.filter((r) => r.status === 'pending' || r.status === 'active');
  const names = await rsnsOf(live.flatMap((r) => [r.challengerAccountId, r.opponentAccountId]));
  return live.map((r) => viewOf(r, acct.playerId, names));
}

/**
 * A person's record. `publicOnly` counts only results both sides agreed to show — what anyone but
 * the person sees on their profile. `accountId` narrows it to challenges played AS one character: a
 * character's public page must never total up wins from the person's other characters, which would
 * say they are one person.
 */
export async function recordForPlayer(
  playerId: number,
  publicOnly: boolean,
  accountId?: number,
): Promise<H2hRecord & { lastWin: { rsn: string; label: string; kind: H2hKind } | null }> {
  const rows = await db
    .select()
    .from(h2hChallenges)
    .where(
      and(
        or(eq(h2hChallenges.challengerPlayerId, playerId), eq(h2hChallenges.opponentPlayerId, playerId)),
        accountId
          ? or(eq(h2hChallenges.challengerAccountId, accountId), eq(h2hChallenges.opponentAccountId, accountId))
          : undefined,
        eq(h2hChallenges.status, 'finished'),
        publicOnly ? and(eq(h2hChallenges.challengerPublic, true), eq(h2hChallenges.opponentPublic, true)) : undefined,
      ),
    )
    .orderBy(sql`${h2hChallenges.finishedAt} desc nulls last`)
    .limit(1000);
  const rec = recordFor(
    rows.map((r) => ({ result: r.result as H2hResult | null, challengerPlayerId: r.challengerPlayerId, opponentPlayerId: r.opponentPlayerId })),
    playerId,
  );
  const win = rows.find((r) => r.result && r.result !== 'tie' && sideOf(r, playerId) === r.result);
  let lastWin: { rsn: string; label: string; kind: H2hKind } | null = null;
  if (win) {
    const other = win.challengerPlayerId === playerId ? win.opponentAccountId : win.challengerAccountId;
    lastWin = { rsn: (await rsnsOf([other])).get(other) ?? '?', label: win.label, kind: win.kind as H2hKind };
  }
  return { ...rec, lastWin };
}

/**
 * The profile card for one character. Its owner sees their whole record and what is waiting on them;
 * anyone else sees only this character's PUBLIC results, and a Challenge button when it can take one.
 */
export async function h2hProfileCard(accountId: number, viewerPlayerId: number | null): Promise<{
  owner: boolean;
  record: H2hRecord;
  lastWin: { rsn: string; label: string; kind: H2hKind } | null;
  canChallenge: boolean;
  pending: number;
} | null> {
  const acct = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
    columns: { playerId: true, rsn: true, verifiedAt: true, provisional: true },
  });
  if (!acct) return null;
  const owner = viewerPlayerId != null && viewerPlayerId === acct.playerId;
  const rec = owner ? await recordForPlayer(acct.playerId, false) : await recordForPlayer(acct.playerId, true, accountId);
  const canChallenge = !owner && !!acct.verifiedAt && acct.provisional === 0 && !!(await eligibleCharacter(acct.rsn));
  const pending = owner ? await pendingInvitesFor(acct.playerId) : 0;
  const { lastWin, ...record } = rec;
  return { owner, record, lastWin, canChallenge, pending };
}

/** Invitations waiting on this person. */
export async function pendingInvitesFor(playerId: number, now = new Date()): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(h2hChallenges)
    .where(and(eq(h2hChallenges.opponentPlayerId, playerId), eq(h2hChallenges.status, 'pending'), sql`${h2hChallenges.respondBy} > ${now}`));
  return n;
}

// ── Telling people ───────────────────────────────────────────────────────────────────────────────

/** The plugin's chat-feed line shape (lib/chatFeedRules FeedMessage), with our own tag. */
function line(text: string, tone: 'info' | 'near' | 'done' | 'feed') {
  return { t: 'feed', kind: 'h2h', tone, tag: 'Head-to-head', who: '', text: text.slice(0, 160) };
}

async function loginsOf(playerIds: number[]): Promise<{ id: number; discordId: string | null }[]> {
  if (!playerIds.length) return [];
  return db.select({ id: users.id, discordId: users.discordId }).from(users).where(and(inArray(users.playerId, playerIds), eq(users.banned, false)));
}

async function pushLine(userIds: number[], m: ReturnType<typeof line>): Promise<void> {
  for (let i = 0; i < userIds.length; i += 200) {
    await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'feed', u: userIds.slice(i, i + 200), m })})`);
  }
}

/**
 * One person hears about it: a line in their game chat (the plugin's chat feed, live), and for an
 * invitation a Discord DM from Anvil's own bot when it shares a server with them. Best effort: the
 * page is the record, so nothing here may fail the request. Beta never DMs (it shares real Discord).
 */
async function tellPerson(playerId: number, text: string, tone: 'info' | 'near' | 'done', opts: { dm?: string } = {}): Promise<void> {
  try {
    const logins = await loginsOf([playerId]);
    await pushLine(logins.map((l) => l.id), line(text, tone));
    const token = opts.dm && !isPreview() ? sharedBotToken() : null;
    if (!token) return;
    for (const l of logins) {
      if (!l.discordId) continue;
      const dm = await discordRest(token, '/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: l.discordId }) });
      if (!dm.ok) continue;
      const channel = (await dm.json()) as { id: string };
      await discordRest(token, `/channels/${channel.id}/messages`, { method: 'POST', body: JSON.stringify({ content: opts.dm, allowed_mentions: { parse: [] } }) });
    }
  } catch (err) {
    log.warn('h2h.tell-failed', { playerId, message: (err as Error).message });
  }
}

/**
 * The result. Both players always hear it. Their clanmates hear it only when BOTH chose to make it
 * public — by default a challenge stays between the two of them.
 */
async function announceResult(r: Row): Promise<void> {
  const names = await rsnsOf([r.challengerAccountId, r.opponentAccountId]);
  const sentence = resultSentence(
    r.kind as H2hKind,
    r.label,
    (r.result as H2hResult) ?? 'tie',
    { challenger: names.get(r.challengerAccountId) ?? '?', opponent: names.get(r.opponentAccountId) ?? '?' },
    r.kind === 'drop' ? undefined : { challenger: r.challengerScore, opponent: r.opponentScore },
  );
  const players = await loginsOf([r.challengerPlayerId, r.opponentPlayerId]);
  await pushLine(players.map((p) => p.id), line(`${sentence}.`, 'done'));
  if (!isPublic(r)) return;
  const audience = await clanmateLogins([r.challengerAccountId, r.opponentAccountId]);
  const own = new Set(players.map((p) => p.id));
  await pushLine(audience.filter((id) => !own.has(id)), line(`${sentence}.`, 'feed'));
  await postToClans(r, 'result', sentence).catch((err) => log.warn('h2h.clan-post-failed', { id: r.id, message: (err as Error).message }));
}

/**
 * A public challenge in each clan either player holds a member seat in, through that clan's own
 * Challenges channel (sendChallengesWebhook: nothing when unset or switched off). Clanmates read as
 * one clan's post; across clans, each clan's post names the other side's clan, so "both clans
 * allow it" is simply both clans having the channel set. Only clans a stranger may see named.
 */
async function postToClans(r: Pick<Row, 'id' | 'kind' | 'label' | 'durationMin' | 'challengerAccountId' | 'opponentAccountId'>, phase: 'start' | 'result', sentence?: string): Promise<void> {
  // clan-scope: global -- the clans are found from these two characters' own member seats.
  const seats = await db
    .select({ accountId: clanMemberships.accountId, clanId: clans.id, clanName: clans.name })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(inArray(clanMemberships.accountId, [r.challengerAccountId, r.opponentAccountId]), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt), eq(clans.platformHidden, false)));
  if (!seats.length) return;
  const names = await rsnsOf([r.challengerAccountId, r.opponentAccountId]);
  const clansOf = (accountId: number) => seats.filter((s) => s.accountId === accountId);
  const who = (accountId: number, clanId: number) => {
    const rsn = names.get(accountId) ?? '?';
    const theirs = clansOf(accountId);
    // Named by clan only when they are not in the clan reading it.
    return theirs.length && !theirs.some((s) => s.clanId === clanId) ? `${rsn} (${theirs[0].clanName})` : rsn;
  };
  const url = absoluteUrl('/challenges');
  for (const clanId of new Set(seats.map((s) => s.clanId))) {
    const a = who(r.challengerAccountId, clanId);
    const b = who(r.opponentAccountId, clanId);
    const embed =
      phase === 'start'
        ? { title: '⚔️ Challenge on', description: `**${a}** vs **${b}**\n${describe(r.kind as H2hKind, r.label, r.durationMin)}.`, color: 0xe0aa1e, url }
        : { title: '🏆 Challenge over', description: `${sentence}.`, color: 0x23a55a, url };
    await sendChallengesWebhook(clanId, { embeds: [embed] });
  }
}

/** Logins of everyone holding a member seat in either character's clan(s). */
async function clanmateLogins(accountIds: number[]): Promise<number[]> {
  // clan-scope: global -- the clans are found from these two characters' own member seats.
  const seats = await db
    .select({ clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .where(and(inArray(clanMemberships.accountId, accountIds), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  const clanIds = [...new Set(seats.map((s) => s.clanId))];
  if (!clanIds.length) return [];
  // clan-scope: this clan -- filtered to the clans found above.
  const rows = await db
    .selectDistinct({ id: users.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(inArray(clanMemberships.clanId, clanIds), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)))
    .limit(2000);
  return rows.map((r) => r.id);
}
