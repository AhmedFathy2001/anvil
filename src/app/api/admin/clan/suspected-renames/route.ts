import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers } from '@/db/schema';
import { and, gte, inArray } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';

// GET /api/admin/clan/suspected-renames
//
// Scans recent clan_audit_log entries for "left" + "joined" pairs that look like the
// same player renamed (when the plugin couldn't anchor the rename via accountHash).
//
// Heuristic — both signals required:
//   • The two audit events occurred within ±WINDOW_MS of each other (typical: same
//     clan-sync produces both, so they're within seconds).
//   • The "left" member's last-known rank matches the "joined" member's rank.
//
// We deliberately don't auto-merge — false positives are real (two unrelated members
// with the same rank can join/leave around the same time). Mods get the pair on the
// audit page with a "Merge" button that calls the existing /api/admin/clan/merge.

const WINDOW_MS = 10 * 60 * 1000;
const LOOKBACK_DAYS = 30;

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

  // Pre-fetch the clan_members rows referenced by either side so we can read ranks
  // and current rsns without N+1 queries.
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

  interface Suggestion {
    leftMemberId: number;
    joinedMemberId: number;
    oldRsn: string;
    newRsn: string;
    rank: string | null;
    leftAt: string;
    joinedAt: string;
    deltaSeconds: number;
  }

  const suggestions: Suggestion[] = [];
  // Avoid pairing the same joined row to multiple lefts (or vice versa) — each side
  // can be in at most one suggestion. We pair greedily by smallest time delta first.
  const pairings: { left: typeof left[number]; joined: typeof joined[number]; delta: number }[] = [];
  for (const l of left) {
    if (l.clanMemberId == null) continue;
    const lm = memberById.get(l.clanMemberId);
    if (!lm) continue;
    const lt = new Date(l.occurredAt).getTime();
    for (const j of joined) {
      if (j.clanMemberId == null) continue;
      if (j.clanMemberId === l.clanMemberId) continue;
      const jm = memberById.get(j.clanMemberId);
      if (!jm) continue;
      const jt = new Date(j.occurredAt).getTime();
      const delta = Math.abs(jt - lt);
      if (delta > WINDOW_MS) continue;
      const lrank = (lm.rank ?? '').toLowerCase().trim();
      const jrank = (joinedRank(j.newValue) ?? jm.rank ?? '').toLowerCase().trim();
      if (lrank !== jrank) continue;
      pairings.push({ left: l, joined: j, delta });
    }
  }
  pairings.sort((a, b) => a.delta - b.delta);

  const usedLeft = new Set<number>();
  const usedJoined = new Set<number>();
  for (const p of pairings) {
    if (usedLeft.has(p.left.id) || usedJoined.has(p.joined.id)) continue;
    usedLeft.add(p.left.id);
    usedJoined.add(p.joined.id);
    const lm = memberById.get(p.left.clanMemberId!)!;
    const jm = memberById.get(p.joined.clanMemberId!)!;
    suggestions.push({
      leftMemberId: lm.id,
      joinedMemberId: jm.id,
      oldRsn: lm.rsn,
      newRsn: jm.rsn,
      rank: lm.rank ?? jm.rank ?? null,
      leftAt: p.left.occurredAt,
      joinedAt: p.joined.occurredAt,
      deltaSeconds: Math.round(p.delta / 1000),
    });
  }

  // Sort newest first.
  suggestions.sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1));

  return NextResponse.json({ suggestions });
}
