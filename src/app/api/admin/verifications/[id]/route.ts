import { NextResponse } from 'next/server';
import { seatForRequest } from '@/lib/roster';
import { db } from '@/db';
import { clanAuditLog, detectedAccounts } from '@/db/schema';
import { loginOf, unclaimAccountOfSeat, updateAccountOfSeat } from '@/lib/roster';
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

  const member = await seatForRequest(request, memberId);
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

  // reject — revoke verification, free the member up for re-claim. Only a claim still under review:
  // this now takes the account away, and a settled member is not something this queue can undo.
  if (!member.provisional) {
    return NextResponse.json({ error: 'Member is not provisional' }, { status: 400 });
  }
  // reject — revoke verification, free the member up for re-claim.
  //
  // THE ACCOUNT GOES BACK, not just the stamp. Clearing claimedAt alone left the account under the
  // claimant's person — still listed as theirs, still resolving their plugin to this seat — which is
  // the opposite of a rejection. It returns to a placeholder person of its own, the state every
  // unclaimed roster account is in.
  const claimantLogin = await loginOf(member.playerId);
  await unclaimAccountOfSeat(memberId);
  await updateAccountOfSeat(memberId, {
    provisional: 0,
    verifiedAt: null,
    verificationMethod: null,
    verifiedByUserId: null,
    claimedAt: null,
    // A first-use claim anchored the claimant's client hash. Rejected, that hash is theirs, not the
    // account's — left in place it would lock the real owner's plugin out.
    ...(member.verificationMethod === 'plugin_first_use' ? { accountHash: null } : {}),
  });
  // And their plugin must not simply take it again on the next request: first-use auto-claim honours
  // a dismissed suggestion, so record one. They can still prove it with the XP check.
  if (claimantLogin != null) {
    const nowIso = new Date().toISOString();
    await db
      .insert(detectedAccounts)
      .values({
        userId: claimantLogin,
        rsn: member.rsn,
        rsnNormalized: member.rsnNormalized,
        status: 'dismissed',
        detectedAt: nowIso,
        lastSeenAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [detectedAccounts.userId, detectedAccounts.rsnNormalized],
        set: { status: 'dismissed', accountHash: null },
      });
  }

  db.insert(clanAuditLog)
    .values({
      clanMemberId: memberId,
      eventType: 'mod_rejected',
      oldValue: JSON.stringify({ provisional: 1, method: member.verificationMethod, claimantUserId: claimantLogin }),
      actorUserId: session.userId > 0 ? session.userId : null,
      notes: body.note || null,
    })
    .catch(() => {});

  return NextResponse.json({ success: true, status: 'rejected' });
}
