import { NextResponse } from 'next/server';
import { seatForRequest } from '@/lib/roster';
import { db } from '@/db';
import { clanAuditLog, clanMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { updateAccountOfSeat } from '@/lib/roster';
import { raiseCharacterReport } from '@/lib/characterReportActions';
import { atLeast } from '@/lib/clanRoles';
import { verifyAdminOrModerator } from '@/lib/auth';
import { applyPendingRole } from '@/lib/pending-role';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';

// POST /api/admin/verifications/[id] { action: 'approve' | 'reject' | 'not_member', note? }
// Approve clears the review flag — nothing about the account changes but that.
// Reject REPORTS the link to Anvil (lib/characterReports); only platform staff take a character off
// someone — except that the clan OWNER's report is carried out at once and waits on /staff as
// "applied" for staff to approve or revert (lib/characterReportActions). Both actions log to
// clan_audit_log.
// Not our member ends THIS clan's guest seat for the character — the clan's own call (clans own seats)
// — and marks it manual so playing doesn't put it back. The character stays linked to whoever owns it:
// "someone else played my uncle's RuneLite" is a clan saying "not ours", not an ownership dispute.
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

  if (body.action !== 'approve' && body.action !== 'reject' && body.action !== 'not_member') {
    return NextResponse.json({ error: "action must be 'approve', 'reject' or 'not_member'" }, { status: 400 });
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

  if (body.action === 'not_member') {
    if (member.leftAt) return NextResponse.json({ error: 'Already off your roster' }, { status: 400 });
    // The in-game roster put a member here, and the next sync would put them straight back.
    if (member.kind === 'member' && member.source === 'roster') {
      return NextResponse.json(
        { error: 'They’re on your in-game clan roster — remove them in game, or Report to Anvil if the character isn’t theirs.' },
        { status: 400 },
      );
    }
    // clan-scope: global -- the seat was resolved inside this clan by seatForRequest above.
    await db
      .update(clanMemberships)
      .set({ leftAt: new Date().toISOString(), source: 'manual' })
      .where(eq(clanMemberships.id, memberId));
    db.insert(clanAuditLog)
      .values({
        clanId: member.clanId,
        clanMemberId: memberId,
        eventType: 'mod_not_member',
        oldValue: JSON.stringify({ provisional: member.provisional, kind: member.kind, source: member.source }),
        newValue: JSON.stringify({ left: true }),
        actorUserId: session.userId > 0 ? session.userId : null,
        notes: body.note || null,
      })
      .catch(() => {});
    return NextResponse.json({ success: true, status: 'removed' });
  }

  // REPORT, not reject. Rejecting took the character off the person — an ownership change that holds
  // in every clan they play in, decided by one. A clan now raises it with Anvil
  // (lib/characterReports) and platform staff decide; the link stays as it is meanwhile, flagged.
  if (!member.provisional) {
    return NextResponse.json({ error: 'Member is not provisional' }, { status: 400 });
  }
  const report = await raiseCharacterReport(
    {
      accountId: member.accountId,
      clanId: member.clanId,
      reportedByUserId: session.userId > 0 ? session.userId : null,
      kind: 'claim_review',
      body: body.note || `Clan staff dispute this link (${member.verificationMethod ?? 'unknown method'}).`,
    },
    { apply: atLeast(session.role, 'owner') },
  );

  db.insert(clanAuditLog)
    .values({
      clanMemberId: memberId,
      eventType: 'mod_reported',
      oldValue: JSON.stringify({ provisional: 1, method: member.verificationMethod }),
      newValue: JSON.stringify({ reportId: report.id, applied: report.applied }),
      actorUserId: session.userId > 0 ? session.userId : null,
      notes: body.note || null,
    })
    .catch(() => {});

  return NextResponse.json({
    success: true,
    status: report.applied ? 'applied' : 'reported',
    reportId: report.id,
    why: report.why,
  });
}
