import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  clanAuditLog,
  clanMembers,
  players,
  weeklyParticipants,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';

// POST /api/admin/clan/merge { sourceId, targetId }
// Merge two clan_members rows that are actually the same player (typically a left+joined
// pair from a rename when accountHash wasn't available). Moves all references to target
// and deletes source.
//
// Why both rows can exist: clan-sync only sees RSNs; without an accountHash to anchor
// identity, a rename looks like "X left, Y joined". A mod making a judgment call uses
// this endpoint to reconcile.
export async function POST(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sourceId?: number; targetId?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sourceId = Number(body.sourceId);
  const targetId = Number(body.targetId);
  if (!Number.isFinite(sourceId) || !Number.isFinite(targetId) || sourceId === targetId) {
    return NextResponse.json({ error: 'Distinct sourceId and targetId required' }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    db.query.clanMembers.findFirst({ where: eq(clanMembers.id, sourceId) }),
    db.query.clanMembers.findFirst({ where: eq(clanMembers.id, targetId) }),
  ]);
  if (!source || !target) {
    return NextResponse.json({ error: 'Source or target not found' }, { status: 404 });
  }

  // Refuse if both are actively claimed by different users — that's a real conflict that
  // needs the users involved to resolve, not an admin merge.
  if (source.userId && target.userId && source.userId !== target.userId) {
    return NextResponse.json(
      { error: 'Both records are claimed by different users. Resolve ownership before merging.' },
      { status: 409 },
    );
  }

  const targetPrevious: string[] = (() => {
    if (!target.previousRsns) return [];
    try {
      const parsed = JSON.parse(target.previousRsns);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const sourcePrevious: string[] = (() => {
    if (!source.previousRsns) return [];
    try {
      const parsed = JSON.parse(source.previousRsns);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  // The source's current rsn itself is now historical for the target.
  const merged = Array.from(new Set([...targetPrevious, ...sourcePrevious, source.rsn].filter(Boolean)));

  // Move references off of source.
  await db.update(players).set({ clanMemberId: targetId }).where(eq(players.clanMemberId, sourceId));
  await db
    .update(weeklyParticipants)
    .set({ clanMemberId: targetId })
    .where(eq(weeklyParticipants.clanMemberId, sourceId));
  await db
    .update(clanAuditLog)
    .set({ clanMemberId: targetId })
    .where(eq(clanAuditLog.clanMemberId, sourceId));

  // Promote any source-side fields the target is missing.
  await db
    .update(clanMembers)
    .set({
      previousRsns: merged.length ? JSON.stringify(merged) : null,
      accountHash: target.accountHash ?? source.accountHash,
      userId: target.userId ?? source.userId,
      verifiedAt: target.verifiedAt ?? source.verifiedAt,
      verificationMethod: target.verificationMethod ?? source.verificationMethod,
      claimedAt: target.claimedAt ?? source.claimedAt,
    })
    .where(eq(clanMembers.id, targetId));

  await db.delete(clanMembers).where(eq(clanMembers.id, sourceId));

  // Audit the merge against the surviving target so history stays attached.
  db.insert(clanAuditLog)
    .values({
      clanMemberId: targetId,
      eventType: 'merged',
      oldValue: JSON.stringify({ mergedFromMemberId: sourceId, mergedFromRsn: source.rsn }),
      newValue: JSON.stringify({ intoMemberId: targetId, rsn: target.rsn }),
      actorUserId: session.userId > 0 ? session.userId : null,
      notes: body.note || null,
    })
    .catch(() => {});

  return NextResponse.json({ success: true, targetId, mergedRsn: source.rsn });
}
