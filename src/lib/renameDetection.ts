// Spotting a rename the in-game roster can only report as "X left, Y joined".
//
// The roster carries names, never account hashes, so a sync after a rename seats the new name as a
// stranger and marks the old one gone (the old character keeps the event entry and the baseline; the
// new one is polled but tracks nothing). This pairs the two back up. Evidence, ALL required — the
// heuristic the review screen already used:
//   - a `left` and a `joined` audit row in the SAME clan within WINDOW_MS (one sync writes both);
//   - the same in-game rank;
//   - overall XP that lines up: the new name has at least the old XP, and not much more (xpVerdict).
//     Rank and time alone produce garbage when a common rank has many members or one bulk sync
//     stamps lots of joins and leaves at once; XP is the decisive signal.
//
// CONFIDENT pairs — each side has exactly ONE XP-confirmed partner — are applied automatically by
// the 15-minute cron (lib/characterRename absorbs the stranger into the real character). Ambiguous
// ones stay as suggestions on the clan's audit page, and on a claimed character go to Anvil.

import { and, desc, eq, gte, inArray, ne } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanMemberships, clanRoster, playerSnapshots } from '@/db/schema';
import { fetchHiscoresSnapshot } from '@/lib/hiscores';

const WINDOW_MS = 10 * 60 * 1000;
const REL_TOLERANCE = 0.05;
const ABS_TOLERANCE = 200_000;

export function xpVerdict(leftXp: number | undefined, joinedXp: number | undefined): { ok: boolean; pct: number } | null {
  if (typeof leftXp !== 'number' || typeof joinedXp !== 'number') return null;
  const diff = joinedXp - leftXp;
  const absDiff = Math.abs(diff);
  const pct = absDiff / Math.max(leftXp, 1);
  // A clear XP DROP means a different, smaller account took the name.
  if (diff < -ABS_TOLERANCE) return { ok: false, pct };
  if (absDiff <= ABS_TOLERANCE) return { ok: true, pct };
  return { ok: pct <= REL_TOLERANCE, pct };
}

export interface SuspectedRename {
  leftMemberId: number;
  joinedMemberId: number;
  leftAccountId: number;
  joinedAccountId: number;
  oldRsn: string;
  newRsn: string;
  rank: string | null;
  leftAt: string;
  joinedAt: string;
  deltaSeconds: number;
  leftXp: number | null;
  joinedXp: number | null;
  /** |joined-left| / left, rounded to 1 decimal; lower = closer. */
  xpMatchPct: number | null;
  /** Each side has exactly one XP-confirmed partner — safe to apply without a human. */
  confident: boolean;
  /** The old character has an owner — a clan does not rename it; Anvil (or the cron) does. */
  leftClaimed: boolean;
}

/** Suspected renames in ONE clan over the last `lookbackDays`. */
export async function detectSuspectedRenames(
  clanId: number,
  opts: { lookbackDays?: number; liveFetchCap?: number } = {},
): Promise<SuspectedRename[]> {
  const since = new Date(Date.now() - (opts.lookbackDays ?? 30) * 24 * 60 * 60 * 1000).toISOString();
  const recent = await db
    .select({
      id: clanAuditLog.id,
      clanMemberId: clanAuditLog.clanMemberId,
      eventType: clanAuditLog.eventType,
      newValue: clanAuditLog.newValue,
      occurredAt: clanAuditLog.occurredAt,
    })
    .from(clanAuditLog)
    .where(
      and(
        // THIS clan's audit rows only — the review screen used to pair every clan's.
        eq(clanAuditLog.clanId, clanId),
        inArray(clanAuditLog.eventType, ['left', 'joined']),
        gte(clanAuditLog.occurredAt, since),
      ),
    );
  const left = recent.filter((r) => r.eventType === 'left');
  const joined = recent.filter((r) => r.eventType === 'joined');
  if (left.length === 0 || joined.length === 0) return [];

  const dismissedRows = await db
    .select({ oldValue: clanAuditLog.oldValue, clanMemberId: clanAuditLog.clanMemberId })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.clanId, clanId), eq(clanAuditLog.eventType, 'rename_dismissed')));
  const dismissedPairs = new Set<string>();
  for (const d of dismissedRows) {
    try {
      const parsed = JSON.parse(d.oldValue ?? '{}') as { memberId?: number };
      if (typeof parsed.memberId === 'number' && d.clanMemberId != null) dismissedPairs.add(`${parsed.memberId}:${d.clanMemberId}`);
    } catch {
      /* skip malformed */
    }
  }

  const memberIds = [...new Set([...left, ...joined].map((r) => r.clanMemberId).filter((id): id is number => id != null))];
  const memberRows = memberIds.length
    ? await db.select().from(clanRoster).where(and(eq(clanRoster.clanId, clanId), inArray(clanRoster.id, memberIds)))
    : [];
  const memberById = new Map(memberRows.map((m) => [m.id, m]));

  const joinedRank = (newValue: string | null): string | null => {
    if (!newValue) return null;
    try {
      return (JSON.parse(newValue) as { rank?: string | null }).rank ?? null;
    } catch {
      return null;
    }
  };

  interface Candidate {
    left: (typeof left)[number];
    joined: (typeof joined)[number];
    leftId: number;
    joinedId: number;
    delta: number;
  }
  const candidates: Candidate[] = [];
  for (const l of left) {
    if (l.clanMemberId == null) continue;
    const lm = memberById.get(l.clanMemberId);
    if (!lm) continue;
    const lt = new Date(l.occurredAt).getTime();
    for (const j of joined) {
      if (j.clanMemberId == null || j.clanMemberId === l.clanMemberId) continue;
      if (dismissedPairs.has(`${l.clanMemberId}:${j.clanMemberId}`)) continue;
      const jm = memberById.get(j.clanMemberId);
      if (!jm || jm.accountId === lm.accountId) continue;
      const delta = Math.abs(new Date(j.occurredAt).getTime() - lt);
      if (delta > WINDOW_MS) continue;
      const lrank = (lm.rank ?? '').toLowerCase().trim();
      const jrank = (joinedRank(j.newValue) ?? jm.rank ?? '').toLowerCase().trim();
      if (lrank !== jrank) continue;
      candidates.push({ left: l, joined: j, leftId: l.clanMemberId, joinedId: j.clanMemberId, delta });
    }
  }
  if (candidates.length === 0) return [];

  // Latest stored overall XP per account (snapshots are keyed by ACCOUNT, candidates by SEAT).
  const seatIds = [...new Set(candidates.flatMap((c) => [c.leftId, c.joinedId]))];
  const accountBySeat = new Map<number, number>();
  for (const id of seatIds) {
    const a = memberById.get(id)?.accountId;
    if (a != null) accountBySeat.set(id, a);
  }
  const accountIds = [...new Set(accountBySeat.values())];
  const snaps = accountIds.length
    ? await db
        .select({ accountId: playerSnapshots.accountId, overallXp: playerSnapshots.overallXp })
        .from(playerSnapshots)
        .where(inArray(playerSnapshots.accountId, accountIds))
        .orderBy(desc(playerSnapshots.capturedAt))
    : [];
  const xpByAccount = new Map<number, number>();
  for (const s of snaps) if (!xpByAccount.has(s.accountId) && typeof s.overallXp === 'number') xpByAccount.set(s.accountId, s.overallXp);
  const xpBySeat = new Map<number, number>();
  for (const [seat, acct] of accountBySeat) {
    const xp = xpByAccount.get(acct) ?? memberById.get(seat)?.statsOverallXp ?? undefined;
    if (typeof xp === 'number') xpBySeat.set(seat, xp);
  }

  // Live hiscores only for the JOINED side with no XP yet (a freshly-seen name), capped.
  const needsLive = seatIds
    .filter((id) => !xpBySeat.has(id) && candidates.some((c) => c.joinedId === id) && memberById.get(id)?.leftAt == null)
    .slice(0, opts.liveFetchCap ?? 8);
  await Promise.all(
    needsLive.map(async (id) => {
      const m = memberById.get(id);
      if (!m) return;
      const snap = await fetchHiscoresSnapshot(m.rsn);
      const xp = snap?.skills?.overall?.xp;
      if (typeof xp === 'number') xpBySeat.set(id, xp);
    }),
  );

  const confirmed = candidates
    .map((c) => ({ c, verdict: xpVerdict(xpBySeat.get(c.leftId), xpBySeat.get(c.joinedId)) }))
    .filter((x): x is { c: Candidate; verdict: { ok: boolean; pct: number } } => x.verdict?.ok === true)
    .sort((a, b) => a.verdict.pct - b.verdict.pct || a.c.delta - b.c.delta);

  // Confidence: count XP-confirmed partners per side BEFORE the greedy assignment.
  const partnersOfLeft = new Map<number, number>();
  const partnersOfJoined = new Map<number, number>();
  for (const { c } of confirmed) {
    partnersOfLeft.set(c.leftId, (partnersOfLeft.get(c.leftId) ?? 0) + 1);
    partnersOfJoined.set(c.joinedId, (partnersOfJoined.get(c.joinedId) ?? 0) + 1);
  }

  const usedLeft = new Set<number>();
  const usedJoined = new Set<number>();
  const out: SuspectedRename[] = [];
  for (const { c, verdict } of confirmed) {
    if (usedLeft.has(c.leftId) || usedJoined.has(c.joinedId)) continue;
    usedLeft.add(c.leftId);
    usedJoined.add(c.joinedId);
    const lm = memberById.get(c.leftId)!;
    const jm = memberById.get(c.joinedId)!;
    out.push({
      leftMemberId: lm.id,
      joinedMemberId: jm.id,
      leftAccountId: lm.accountId,
      joinedAccountId: jm.accountId,
      oldRsn: lm.rsn,
      newRsn: jm.rsn,
      rank: lm.rank ?? jm.rank ?? null,
      leftAt: c.left.occurredAt,
      joinedAt: c.joined.occurredAt,
      deltaSeconds: Math.round(c.delta / 1000),
      leftXp: xpBySeat.get(c.leftId) ?? null,
      joinedXp: xpBySeat.get(c.joinedId) ?? null,
      xpMatchPct: Math.round(verdict.pct * 1000) / 10,
      confident: partnersOfLeft.get(c.leftId) === 1 && partnersOfJoined.get(c.joinedId) === 1,
      leftClaimed: lm.claimedAt != null,
    });
  }
  out.sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1));
  return out;
}

/**
 * Apply the confident suspected renames from recent syncs, across clans. The cron's job: a rename
 * the roster split heals within one tick instead of waiting for someone to notice.
 *
 * Only the left side's character is renamed (absorbing the stranger the sync made — see
 * lib/characterRename); a stranger that turns out to be somebody else's character is refused there
 * and raised with Anvil instead.
 */
export async function applyConfidentRenames(opts: { lookbackDays?: number; maxClans?: number; liveFetchCap?: number } = {}) {
  const since = new Date(Date.now() - (opts.lookbackDays ?? 2) * 24 * 60 * 60 * 1000).toISOString();
  // clan-scope: global -- the platform cron; each clan is then detected and repaired on its own.
  const clansWithChurn = await db
    .selectDistinct({ clanId: clanAuditLog.clanId })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.eventType, 'joined'), gte(clanAuditLog.occurredAt, since)))
    .limit(opts.maxClans ?? 25);

  const { renameCharacter } = await import('@/lib/characterRename');
  const { fileCharacterReport } = await import('@/lib/characterReports');
  let applied = 0;
  let raised = 0;
  for (const { clanId } of clansWithChurn) {
    if (clanId == null) continue;
    const pairs = await detectSuspectedRenames(clanId, { lookbackDays: opts.lookbackDays ?? 2, liveFetchCap: opts.liveFetchCap ?? 4 });
    for (const p of pairs.filter((x) => x.confident)) {
      // A SYNC IS A CLAN ADMIN'S PUSH, so what it may rename on its own is only what that clan owns:
      // an UNCLAIMED character seated in this clan alone. A claimed character is its player's in every
      // clan — a crafted roster ("X left, Y joined", with Y picked to match X's XP) must not rename
      // it — and one seated elsewhere is other clans' data too. Those go to Anvil with the evidence;
      // a claimed player's own plugin still heals it on their next login (renameFromPlugin).
      // clan-scope: global -- where else this character sits is exactly the question.
      const elsewhere = await db
        .select({ id: clanMemberships.id })
        .from(clanMemberships)
        .where(and(eq(clanMemberships.accountId, p.leftAccountId), ne(clanMemberships.clanId, clanId)))
        .limit(1);
      const res =
        p.leftClaimed || elsewhere.length > 0
          ? ({ ok: false, error: p.leftClaimed ? 'it belongs to a player, so Anvil applies it' : 'it is on other clans’ rosters too' } as const)
          : await renameCharacter(p.leftAccountId, p.newRsn, {
              actorUserId: null,
              via: 'roster',
              note: `Roster showed ${p.oldRsn} leaving and ${p.newRsn} joining at the same rank with matching XP`,
              absorb: 'split',
            });
      if (res.ok) {
        applied++;
      } else {
        await fileCharacterReport({
          accountId: p.leftAccountId,
          clanId,
          reportedByUserId: null,
          kind: 'rename',
          body: `Looks like ${p.oldRsn} renamed to ${p.newRsn} (same rank, XP within ${p.xpMatchPct}%). Not applied automatically: ${res.error}.`,
          requestedRsn: p.newRsn,
        });
        raised++;
      }
    }
  }
  return { clans: clansWithChurn.length, applied, raised };
}
