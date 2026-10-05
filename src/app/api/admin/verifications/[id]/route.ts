import { NextResponse } from 'next/server';
import { seatForRequest } from '@/lib/roster';
import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { updateAccountOfSeat } from '@/lib/roster';
import { fileCharacterReport } from '@/lib/characterReports';
import { verifyAdminOrModerator } from '@/lib/auth';
import { applyPendingRole } from '@/lib/pending-role';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';

// POST /api/admin/verifications/[id] { action: 'approve' | 'reject', note? }
// Approve clears the review flag — nothing about the account changes but that.
// Reject REPORTS the link to Anvil (lib/characterReports); only platform staff take a character off
// someone. Both actions log to clan_audit_log.
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

  // REPORT, not reject. Rejecting took the character off the person — an ownership change that holds
  // in every clan they play in, decided by one. A clan now raises it with Anvil
  // (lib/characterReports) and platform staff decide; the link stays as it is meanwhile, flagged.
  if (!member.provisional) {
    return NextResponse.json({ error: 'Member is not provisional' }, { status: 400 });
  }
  const report = await fileCharacterReport({
    accountId: member.accountId,
    clanId: member.clanId,
    reportedByUserId: session.userId > 0 ? session.userId : null,
    kind: 'claim_review',
    body: body.note || `Clan staff dispute this link (${member.verificationMethod ?? 'unknown method'}).`,
  });

  db.insert(clanAuditLog)
    .values({
      clanMemberId: memberId,
      eventType: 'mod_reported',
      oldValue: JSON.stringify({ provisional: 1, method: member.verificationMethod }),
      newValue: JSON.stringify({ reportId: report.id }),
      actorUserId: session.userId > 0 ? session.userId : null,
      notes: body.note || null,
    })
    .catch(() => {});

  return NextResponse.json({ success: true, status: 'reported', reportId: report.id });
}
