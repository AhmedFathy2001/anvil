import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdminOrModerator } from '@/lib/auth';
import { approveClaimRequest, rejectClaimRequest } from '@/lib/claimRequests';

// POST /api/admin/claim-requests/[id] { action: 'approve' | 'reject' }
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
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  if (action === 'reject') {
    const res = await rejectClaimRequest(clan.id, id, session.userId);
    if (!res.ok) return NextResponse.json({ error: 'That request is no longer open.' }, { status: 404 });
    return NextResponse.json({ ok: true, action: 'reject' });
  }

  const res = await approveClaimRequest(clan.id, id, session.userId);
  if (!res.ok) {
    const status = res.code === 'not_found' ? 404 : res.code === 'owned_by_other' ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, action: 'approve', accountId: res.accountId });
}
