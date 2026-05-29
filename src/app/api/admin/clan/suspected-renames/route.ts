import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, playerSnapshots } from '@/db/schema';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { fetchHiscoresSnapshot } from '@/lib/hiscores';

// GET /api/admin/clan/suspected-renames
//
// Scans recent clan_audit_log entries for "left" + "joined" pairs that look like the
// same player renamed (when the plugin couldn't anchor the rename via accountHash).
//
// Heuristic — ALL of these required:
//   • The two audit events occurred within ±WINDOW_MS of each other (a real rename
//     produces both in the same clan-sync, so they land within seconds).
//   • The "left" member's last-known rank matches the "joined" member's rank.
//   • Hiscores confirmation: the two accounts' overall XP match closely. This is the
//     decisive signal — rank+time alone produces garbage when a common rank (e.g.
//     "imp") has many members, or when a single bulk sync stamps lots of joins/leaves
//     at the same instant. A real rename keeps the same XP; two different members have
//     wildly different XP and are rejected. XP comes from the stored player_snapshots
//     (no network in the common case); we fall back to a live hiscores fetch only for
//     active joined members that haven't been snapshotted yet.
//
// We deliberately don't auto-merge. Mods get the pair on the audit page with a "Confirm
// rename" button (calls /api/admin/clan/merge) or "Not a rename" (persists a dismissal
// via the POST handler below, so it doesn't reappear on every page load).

const WINDOW_MS = 10 * 60 * 1000;
const LOOKBACK_DAYS = 30;

// XP-match thresholds. A renamed account gains only a little XP between the snapshot
// before it left and the one after it rejoined, so we accept small absolute gains
// outright (covers low-level accounts where a tiny gain is a large %) and otherwise a
// small relative difference. A clear XP *drop* beyond the floor means a different,
// smaller account took the name → reject.
const REL_TOLERANCE = 0.05;
const ABS_TOLERANCE = 200_000;
const LIVE_FETCH_CAP = 8;

function xpVerdict(
  leftXp: number | undefined,
  joinedXp: number | undefined,
): { ok: boolean; pct: number } | null {
  if (typeof leftXp !== 'number' || typeof joinedXp !== 'number') return null;
  const diff = joinedXp - leftXp;
  const absDiff = Math.abs(diff);
  const pct = absDiff / Math.max(leftXp, 1);
  if (diff < -ABS_TOLERANCE) return { ok: false, pct };
  if (absDiff <= ABS_TOLERANCE) return { ok: true, pct };
  return { ok: pct <= REL_TOLERANCE, pct };
}

export async function GET() {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

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
        inArray(clanAuditLog.eventType, ['left', 'joined']),
        gte(clanAuditLog.occurredAt, since),
      ),
    );

  const left = recent.filter((r) => r.eventType === 'left');
  const joined = recent.filter((r) => r.eventType === 'joined');

  if (left.length === 0 || joined.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Pairs a mod already marked "Not a rename" — keyed leftMemberId:joinedMemberId so
  // they never resurface. Persisted as 'rename_dismissed' audit rows by POST below.
  const dismissedRows = await db
    .select({ oldValue: clanAuditLog.oldValue, clanMemberId: clanAuditLog.clanMemberId })
    .from(clanAuditLog)
    .where(eq(clanAuditLog.eventType, 'rename_dismissed'));
  const dismissedPairs = new Set<string>();
  for (const d of dismissedRows) {
    let leftId: number | null = null;
    try {
      const parsed = JSON.parse(d.oldValue ?? '{}') as { memberId?: number };
      if (typeof parsed.memberId === 'number') leftId = parsed.memberId;
    } catch {
      /* skip malformed */
    }
    if (leftId != null && d.clanMemberId != null) dismissedPairs.add(`${leftId}:${d.clanMemberId}`);
  }

  // Pre-fetch the clan_members rows referenced by either side so we can read ranks,
  // rsns, and active state without N+1 queries.
  const memberIds = Array.from(
    new Set(
      [...left, ...joined]
        .map((r) => r.clanMemberId)
        .filter((id): id is number => id != null),
    ),
  );
  const memberRows = memberIds.length > 0
    ? await db.select().from(clanMembers).where(inArray(clanMembers.id, memberIds))
    : [];
  const memberById = new Map(memberRows.map((m) => [m.id, m]));

  function joinedRank(newValue: string | null): string | null {
    if (!newValue) return null;
    try {
      const parsed = JSON.parse(newValue) as { rank?: string | null };
      return parsed.rank ?? null;
    } catch {
      return null;
    }
  }

  // Candidate pairs: within window, same rank, not already dismissed. XP confirmation
  // is applied after, so unconfirmed candidates can't block a confirmed pairing.
  interface Candidate {
    left: typeof left[number];
    joined: typeof joined[number];
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
      if (j.clanMemberId == null) continue;
      if (j.clanMemberId === l.clanMemberId) continue;
      if (dismissedPairs.has(`${l.clanMemberId}:${j.clanMemberId}`)) continue;
      const jm = memberById.get(j.clanMemberId);
      if (!jm) continue;
      const jt = new Date(j.occurredAt).getTime();
      const delta = Math.abs(jt - lt);
      if (delta > WINDOW_MS) continue;
      const lrank = (lm.rank ?? '').toLowerCase().trim();
      const jrank = (joinedRank(j.newValue) ?? jm.rank ?? '').toLowerCase().trim();
      if (lrank !== jrank) continue;
      candidates.push({ left: l, joined: j, leftId: l.clanMemberId, joinedId: j.clanMemberId, delta });
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Latest known overall XP per candidate member, from stored snapshots. Pick the most
  // recent snapshot that actually recorded an overallXp.
  const candidateMemberIds = Array.from(
    new Set(candidates.flatMap((c) => [c.leftId, c.joinedId])),
  );
  const snaps = await db
    .select({
      clanMemberId: playerSnapshots.clanMemberId,
      overallXp: playerSnapshots.overallXp,
    })
    .from(playerSnapshots)
    .where(inArray(playerSnapshots.clanMemberId, candidateMemberIds))
    .orderBy(desc(playerSnapshots.capturedAt));
  const xpByMember = new Map<number, number>();
  for (const s of snaps) {
    if (!xpByMember.has(s.clanMemberId) && typeof s.overallXp === 'number') {
      xpByMember.set(s.clanMemberId, s.overallXp);
    }
  }

  // Live-fetch fallback: only for active joined members with no snapshot XP yet (a
  // freshly-renamed account the stats cron hasn't picked up). Capped + parallel so the
  // admin request stays responsive. Inactive members without a snapshot stay unknown
  // and their pairs get excluded (we never guess).
  const needsLive = candidateMemberIds.filter((id) => {
    if (xpByMember.has(id)) return false;
    const m = memberById.get(id);
    if (!m || m.leftAt != null) return false;
    // Only worth fetching the "joined" side — that's the active name we can look up.
    return candidates.some((c) => c.joinedId === id);
  }).slice(0, LIVE_FETCH_CAP);
  if (needsLive.length > 0) {
    await Promise.all(
      needsLive.map(async (id) => {
        const m = memberById.get(id);
        if (!m) return;
        const snap = await fetchHiscoresSnapshot(m.rsn);
        const xp = snap?.skills?.overall?.xp;
        if (typeof xp === 'number') xpByMember.set(id, xp);
      }),
    );
  }

  interface Suggestion {
    leftMemberId: number;
    joinedMemberId: number;
    oldRsn: string;
    newRsn: string;
    rank: string | null;
    leftAt: string;
    joinedAt: string;
    deltaSeconds: number;
    leftXp: number | null;
    joinedXp: number | null;
    xpMatchPct: number | null; // |joined-left| / left, rounded to 1 decimal; lower = closer
  }

  // Keep only XP-confirmed candidates, then greedily assign each member to at most one
  // pair, preferring the closest XP match (most confident) and breaking ties by the
  // smallest time delta.
  const confirmed = candidates
    .map((c) => ({ c, verdict: xpVerdict(xpByMember.get(c.leftId), xpByMember.get(c.joinedId)) }))
    .filter((x): x is { c: Candidate; verdict: { ok: boolean; pct: number } } => x.verdict?.ok === true)
    .sort((a, b) => (a.verdict.pct - b.verdict.pct) || (a.c.delta - b.c.delta));

  const usedLeft = new Set<number>();
  const usedJoined = new Set<number>();
  const suggestions: Suggestion[] = [];
  for (const { c, verdict } of confirmed) {
    if (usedLeft.has(c.leftId) || usedJoined.has(c.joinedId)) continue;
    usedLeft.add(c.leftId);
    usedJoined.add(c.joinedId);
    const lm = memberById.get(c.leftId)!;
    const jm = memberById.get(c.joinedId)!;
    suggestions.push({
      leftMemberId: lm.id,
      joinedMemberId: jm.id,
      oldRsn: lm.rsn,
      newRsn: jm.rsn,
      rank: lm.rank ?? jm.rank ?? null,
      leftAt: c.left.occurredAt,
      joinedAt: c.joined.occurredAt,
      deltaSeconds: Math.round(c.delta / 1000),
      leftXp: xpByMember.get(c.leftId) ?? null,
      joinedXp: xpByMember.get(c.joinedId) ?? null,
      xpMatchPct: Math.round(verdict.pct * 1000) / 10,
    });
  }

  // Sort newest first.
  suggestions.sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1));

  return NextResponse.json({ suggestions });
}

// POST /api/admin/clan/suspected-renames  { leftMemberId, joinedMemberId }
// Records a "Not a rename" dismissal so the pair never resurfaces in the suggestion
// list. Stored as a 'rename_dismissed' audit row (against the joined member) so it's
// visible in the audit feed and survives reloads.
export async function POST(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { leftMemberId?: number; joinedMemberId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const leftMemberId = Number(body.leftMemberId);
  const joinedMemberId = Number(body.joinedMemberId);
  if (!Number.isFinite(leftMemberId) || !Number.isFinite(joinedMemberId) || leftMemberId === joinedMemberId) {
    return NextResponse.json({ error: 'Distinct leftMemberId and joinedMemberId required' }, { status: 400 });
  }

  await db.insert(clanAuditLog).values({
    clanMemberId: joinedMemberId,
    eventType: 'rename_dismissed',
    oldValue: JSON.stringify({ memberId: leftMemberId }),
    newValue: JSON.stringify({ memberId: joinedMemberId }),
    actorUserId: session.userId > 0 ? session.userId : null,
    notes: 'Mod marked suspected left+joined pair as not a rename',
  });

  return NextResponse.json({ success: true });
}
