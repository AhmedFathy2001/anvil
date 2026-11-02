import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdminOrModerator } from '@/lib/auth';
import { rejectClaimRequest, vouchForClaim } from '@/lib/claimRequests';

// POST /api/admin/claim-requests/[id] { action: 'forward' | 'reject', note? }
//
// 'forward' is the clan's "yes, that's them" (lib/claimRequests vouchForClaim): a character only ever
// on this clan's roster is linked right away by an admin; a clan owner's vouch is linked at once and
// filed with Anvil to double-check only where this clan alone has a stake (lib/characterReportActions
// ownerApplyBlocked); anything else goes to Anvil to decide. The response says which,
// so the page can tell them. 'approve' is accepted as an alias of 'forward'.
//
// A moderator vouching that a person really is the member they claim to be — the human half of the
// takeover fix. Auto-claim by public RSN is gone; the two ways left are the member proving control
// (XP-delta) and this, a mod who knows their roster pressing one button.
//
// Clan-scoped by requireClan AND re-checked inside the lib against this clan's seats, so a mod cannot
// approve a claim on another clan's member by guessing an id.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const clan = await requireClan();
  const session = await verifyAdminOrModerator();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'forward' && action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'forward' or 'reject'" }, { status: 400 });
  }

  if (action === 'reject') {
    const res = await rejectClaimRequest(clan.id, id, session.userId);
    if (!res.ok) return NextResponse.json({ error: 'That request is no longer open.' }, { status: 404 });
    return NextResponse.json({ ok: true, action: 'reject' });
  }

  if (!(session.userId > 0)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const res = await vouchForClaim(
    clan.id,
    id,
    { userId: session.userId, role: session.role },
    typeof body?.note === 'string' ? body.note : null,
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.code === 'not_found' ? 404 : 400 });
  }
  return NextResponse.json({ ...res, action: 'forward' });
}
