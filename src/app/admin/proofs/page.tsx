import { db } from '@/db';
import { clanHref } from '@/lib/clanPath';
import { requireClan } from '@/lib/clanContext';
import { eventParticipants, events, submissions, teams, tiles } from '@/db/schema';
import { and, eq, gt, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { verifyAdminOrModerator } from '@/lib/auth';
import type { Submission, Tile } from '@/lib/types';
import ProofsClient, { type ProofBoard } from './ProofsClient';

export const dynamic = 'force-dynamic';

/**
 * Every flagged proof in the clan, board by board.
 *
 * Flagged proofs were only listed on each event's own Overview, and a moderator without the
 * board-building capability cannot open event pages at all (lib/adminAccess) — so the people whose
 * job is checking proofs had no way to see the queue. This is that queue, at a moderator path, using
 * the Overview's own "Proofs to check" list for each board.
 */
export default async function AdminProofsPage() {
  const session = await verifyAdminOrModerator();
  if (!session) redirect(await clanHref('/admin'));
  const clan = await requireClan();

  // Same window as the dashboard's "What needs you": running boards, and ones that ended within a
  // month — settling flags is part of paying out; an old one nobody cleared shouldn't linger forever.
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const flagged = await db
    .select({ submission: submissions, eventId: events.id, eventName: events.name })
    .from(submissions)
    .innerJoin(tiles, eq(submissions.tileId, tiles.id))
    .innerJoin(events, eq(tiles.eventId, events.id))
    .where(
      and(
        eq(events.clanId, clan.id),
        isNotNull(submissions.flaggedReason),
        or(isNull(events.endDate), gt(events.endDate, cutoff)),
      ),
    );

  const eventIds = [...new Set(flagged.map((r) => r.eventId))];
  const [tileRows, teamRows, players] = eventIds.length
    ? await Promise.all([
        db.select().from(tiles).where(inArray(tiles.eventId, eventIds)),
        db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.eventId, eventIds)),
        db
          .select({ id: eventParticipants.id, name: eventParticipants.name })
          .from(eventParticipants)
          .where(inArray(eventParticipants.eventId, eventIds)),
      ])
    : [[], [], []];
  const playerName = new Map(players.map((p) => [p.id, p.name]));
  const teamNameById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));

  const boards: ProofBoard[] = eventIds.map((id) => {
    const rows = flagged.filter((r) => r.eventId === id);
    return {
      eventId: id,
      name: rows[0].eventName,
      // Same shape the submissions GET returns, names joined, so the shared list renders it as-is.
      submissions: rows.map(({ submission: s }) => ({
        ...s,
        uploaderName: s.playerId ? playerName.get(s.playerId) ?? 'Unknown' : null,
        creditPlayerName: s.creditPlayerId ? playerName.get(s.creditPlayerId) ?? 'Unknown' : null,
      })) as unknown as Submission[],
      tiles: tileRows.filter((t) => t.eventId === id) as unknown as Tile[],
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        Proofs to check
      </h1>
      <p className="text-sm text-text-muted mb-6 max-w-[64ch]">
        Proofs the system wasn&apos;t sure about. They already count — say they look fine, or take them out and
        tell the team why.
      </p>
      <ProofsClient boards={boards} teamNameById={teamNameById} />
    </div>
  );
}
