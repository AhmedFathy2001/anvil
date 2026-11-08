import { NextResponse } from 'next/server';

import { verifyAdmin, verifyUser } from '@/lib/auth';
import { competitionInvites, inviteClanToCompetition, removeCompetitionClan } from '@/lib/competitionTeamsDb';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';
import { competitionForRequest } from '@/lib/eventScope';

/**
 * Clan vs clan invites for a weekly competition the requesting clan OWNS. Admin+ only — inviting
 * another clan speaks for this one, the same bar as an event co-host invite. The invited clan answers
 * at /api/weekly-invites/[id]/respond.
 *
 * GET    → { invites: [{ id, clanId, status, name, slug }] }
 * POST   { slug }  → invite (re-opens a declined invite)
 * DELETE ?inviteId= → withdraw / remove a partner (its players leave the board)
 */
async function scope(request: Request, params: Promise<{ id: string }>) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return { error: notForCreators };
  const session = await verifyUser();
  if (!session || !(await verifyAdmin())) return { error: NextResponse.json({ error: 'Only an owner or admin can manage clan invites' }, { status: 403 }) };
  const comp = await competitionForRequest(request, parseInt((await params).id, 10));
  if (!comp) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { comp, userId: session.userId > 0 ? session.userId : null };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  return NextResponse.json({ invites: await competitionInvites(s.comp.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const body = await request.json().catch(() => ({}));
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  if (!slug.trim()) return NextResponse.json({ error: 'Enter a clan address' }, { status: 400 });
  const r = await inviteClanToCompetition(s.comp, s.comp.clanId, slug, s.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ invites: await competitionInvites(s.comp.id) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const inviteId = Number(new URL(request.url).searchParams.get('inviteId'));
  if (!(await removeCompetitionClan(s.comp, s.comp.clanId, inviteId))) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }
  return NextResponse.json({ invites: await competitionInvites(s.comp.id) });
}
