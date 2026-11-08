import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyParticipants } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { competitionMode } from '@/lib/competitionTeams';
import { buildGroupStandings, competitionInvites, listTeams } from '@/lib/competitionTeamsDb';
import { verifyAdmin } from '@/lib/auth';
import { getWeeklyRow } from '@/lib/weeklyWorkspace';
import WeeklyFormatClient from './WeeklyFormatClient';

export const dynamic = 'force-dynamic';

/** Solo / teams / clan vs clan for one weekly competition, and the teams or clans that go with it. */
export default async function WeeklyFormatPage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = parseInt(weeklyId, 10);

  // Whose competition is this? The id came from the URL — the owning clan only.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  const mode = competitionMode(comp.mode);
  const [teams, participants, invites, standings, isAdmin] = await Promise.all([
    listTeams(id),
    db
      .select({ id: weeklyParticipants.id, rsn: weeklyParticipants.rsn, teamId: weeklyParticipants.teamId })
      .from(weeklyParticipants)
      .where(eq(weeklyParticipants.competitionId, id))
      .orderBy(weeklyParticipants.rsnNormalized),
    competitionInvites(id),
    buildGroupStandings(comp),
    verifyAdmin(),
  ]);

  return (
    <WeeklyFormatClient
      competitionId={id}
      ended={comp.status === 'completed'}
      initialMode={mode}
      initialLateJoin={comp.teamLateJoin}
      initialTeams={teams.map((t) => ({ id: t.id, name: t.name, colour: t.colour }))}
      initialParticipants={participants}
      initialInvites={invites.map((i) => ({ id: i.id, status: i.status, name: i.name, slug: i.slug }))}
      totals={(standings?.groups ?? []).map((g) => ({ key: g.key, total: g.total, average: g.average, members: g.members, rank: g.rank }))}
      canInvite={isAdmin}
    />
  );
}
