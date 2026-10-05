import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdminOrModerator } from '@/lib/auth';
import { forwardClaimRequest, rejectClaimRequest } from '@/lib/claimRequests';

// POST /api/admin/claim-requests/[id] { action: 'forward' | 'reject', note? }
//
// 'forward' sends the mod's vouch to Anvil (lib/characterReports); platform staff make the link. A
// clan no longer binds a character to a person itself — that would change the person in every clan.
// 'approve' is accepted as an alias of 'forward' for a client that has not reloaded.
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

  const res = await forwardClaimRequest(clan.id, id, session.userId, typeof body?.note === 'string' ? body.note : null);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.code === 'not_found' ? 404 : 400 });
  }
  return NextResponse.json({ ok: true, action: 'forward', reportId: res.reportId });
}
