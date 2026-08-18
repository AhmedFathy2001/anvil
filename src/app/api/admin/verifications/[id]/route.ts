import { NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster } from '@/db/schema';
import { findRosterSeat, updateAccountOfSeat } from '@/lib/roster';
import { eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { applyPendingRole } from '@/lib/pending-role';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';

// POST /api/admin/verifications/[id] { action: 'approve' | 'reject' }
// Approve clears the provisional flag — the clan member becomes fully verified.
// Reject revokes the verification (clears userId/verifiedAt/method/claimedAt) so the user
// can re-attempt or another user can claim it. Both actions log to clan_audit_log.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: { action?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const member = await findRosterSeat(eq(clanRoster.id, memberId));
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (body.action === 'approve') {
    if (!member.provisional) {
      return NextResponse.json({ error: 'Member is not provisional' }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    await updateAccountOfSeat(memberId, {
      provisional: 0,
      verifiedByUserId: session.userId > 0 ? session.userId : member.verifiedByUserId,
      // Manual claims arrive with verifiedAt=null because there's no automated proof yet —
      // the mod's approval IS the proof. Stamp the moment of approval so leaderboards and
      // audit trails treat the account as verified going forward.
      verifiedAt: member.verifiedAt ?? nowIso,
    });

    // Apply any pre-assigned SITE role now that the verification has cleared mod review.
    if (member.playerId && member.pendingRole) {
      await applyPendingRole(memberId, member.playerId, 'manual_approval');
    }
    // Give them their Discord roles + nickname now that they're a confirmed member. Fire-and-
    // forget; no-op if role sync is off. (Manual approval previously synced nothing on its own.)
    syncRolesForClanMemberFireAndForget(memberId);

    db.insert(clanAuditLog)
      .values({
        clanMemberId: memberId,
        eventType: 'mod_approved',
        oldValue: JSON.stringify({ provisional: 1, method: member.verificationMethod }),
        newValue: JSON.stringify({ provisional: 0 }),
        actorUserId: session.userId > 0 ? session.userId : null,
        notes: body.note || null,
      })
      .catch(() => {});

    return NextResponse.json({ success: true, status: 'approved' });
  }

  // reject — revoke verification, free the member up for re-claim.
  await updateAccountOfSeat(memberId, {
    provisional: 0,
    verifiedAt: null,
    verificationMethod: null,
    claimedAt: null,
    // Keep the userId in place if present so we don't forget who attempted; but mark
    // as not verified. A fresh link/stat-delta attempt can re-verify.
  });

  db.insert(clanAuditLog)
    .values({
      clanMemberId: memberId,
      eventType: 'mod_rejected',
      oldValue: JSON.stringify({ provisional: 1, method: member.verificationMethod }),
      actorUserId: session.userId > 0 ? session.userId : null,
      notes: body.note || null,
    })
    .catch(() => {});

  return NextResponse.json({ success: true, status: 'rejected' });
}
