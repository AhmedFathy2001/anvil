import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyParticipants } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { competitionMode } from '@/lib/competitionTeams';
import {
  assignParticipants,
  autoBalanceTeams,
  createTeam,
  deleteTeam,
  listTeams,
  placeLateJoiners,
  updateTeam,
} from '@/lib/competitionTeamsDb';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';
import { competitionForRequest } from '@/lib/eventScope';

/**
 * Teams for a teams-mode weekly competition (lib/competitionTeamsDb). Moderator+ of the OWNING clan:
 * competitionForRequest scopes the id to the clan the request addresses, so another clan's
 * competition is a 404 here.
 *
 * GET    → { teams, participants: [{ id, rsn, teamId }] }
 * POST   { action: 'create', name, colour? } | { action: 'autobalance' } |
 *        { action: 'assign', assignments: [{ participantId, teamId|null }] } | { action: 'place-late' }
 * PATCH  { teamId, name?, colour? }
 * DELETE ?teamId=
 */
async function scope(request: Request, params: Promise<{ id: string }>) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return { error: notForCreators };
  const user = await verifyAdminOrModerator();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const comp = await competitionForRequest(request, parseInt((await params).id, 10));
  if (!comp) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { comp };
}

async function snapshot(competitionId: number) {
  const [teams, participants] = await Promise.all([
    listTeams(competitionId),
    db
      .select({ id: weeklyParticipants.id, rsn: weeklyParticipants.rsn, teamId: weeklyParticipants.teamId })
      .from(weeklyParticipants)
      .where(eq(weeklyParticipants.competitionId, competitionId))
      .orderBy(weeklyParticipants.rsnNormalized),
  ]);
  return { teams, participants };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  return NextResponse.json(await snapshot(s.comp.id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const { comp } = s;
  if (competitionMode(comp.mode) !== 'teams') {
    return NextResponse.json({ error: 'Switch the competition to teams first' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  switch (body?.action) {
    case 'create': {
      const r = await createTeam(comp.id, String(body.name ?? ''), body.colour);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      break;
    }
    case 'autobalance': {
      const r = await autoBalanceTeams(comp);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      break;
    }
    case 'assign': {
      const list = Array.isArray(body.assignments) ? body.assignments : [];
      await assignParticipants(
        comp.id,
        list.slice(0, 2000).map((a: { participantId: unknown; teamId: unknown }) => ({
          participantId: Number(a.participantId),
          teamId: a.teamId == null ? null : Number(a.teamId),
        })),
      );
      break;
    }
    case 'place-late':
      await placeLateJoiners(comp.id);
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json(await snapshot(comp.id));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const body = await request.json().catch(() => ({}));
  const n = await updateTeam(s.comp.id, Number(body?.teamId), { name: body?.name, colour: body?.colour });
  if (!n) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  return NextResponse.json(await snapshot(s.comp.id));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const teamId = Number(new URL(request.url).searchParams.get('teamId'));
  const n = await deleteTeam(s.comp.id, teamId);
  if (!n) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  return NextResponse.json(await snapshot(s.comp.id));
}

