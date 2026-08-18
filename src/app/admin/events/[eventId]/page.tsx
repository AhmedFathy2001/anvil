import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { events, tiles, teams, completions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import OverviewClient from './OverviewClient';
import { getTierBands } from '@/lib/pluginConfig';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { eventStage } from '@/lib/eventStage';
import { getRecordedTeamResults } from '@/lib/adminEventsOverview';
import { getEventRecap } from '@/lib/eventRecap';
import { getStageCounts } from '@/lib/eventStageCounts';

export const dynamic = 'force-dynamic';

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const clan = await requireClan();
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, eventTeams, tierBands] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    db.select().from(teams).where(eq(teams.eventId, id)),
    getTierBands(clan.id),
  ]);

  const tileIds = new Set(eventTiles.map((t) => t.id));
  const eventCompletions = tileIds.size
    ? (await db.select().from(completions))
        .filter((c) => tileIds.has(c.tileId))
        .map((c) => ({
          id: c.id,
          teamId: c.teamId,
          tileId: c.tileId,
          completedAt: c.completedAt,
          statContributions: parseContributionSnapshot(c.statContributions),
        }))
    : [];

  const counts = await getStageCounts(id);
  const stage = eventStage(event);
  // A finished event shows what was BANKED, not what recomputes today — the same rows a member's
  // trophies read from, so the two can never disagree about who won.
  const recorded = stage === 'wrap' ? await getRecordedTeamResults(id) : [];
  // The superlatives already exist for the Discord recap post — a finished event's own page is the
  // one place they were never shown.
  const recap = stage === 'wrap' ? await getEventRecap(id).catch(() => null) : null;
  const awards = (recap?.awards ?? []).slice(0, 4).map((a) => ({
    key: a.key,
    emoji: a.emoji,
    title: a.title,
    winner: a.winner.name,
    value: a.winner.valueLabel,
    team: a.winner.teamName,
  }));

  // "Held" is narrower than "not ready": the scheduled start has actually come and gone while the
  // event was unstartable, and the cron has been pushing the date forward. The Build checklist
  // covers the ordinary not-ready case, so only the held one still needs a banner.
  const held = stage === 'build' && counts.blockers.length > 0 && event.startHoldNotified === 1;

  return (
    <>
      {held && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <div className="font-semibold">⏸ Start is being held</div>
          <p className="mt-1 text-sm">
            The scheduled start time was reached, but the event is being held back until it&apos;s ready:
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {counts.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <OverviewClient
        event={event}
        tiles={eventTiles}
        teams={eventTeams}
        completions={eventCompletions}
        stage={stage}
        counts={counts}
        recorded={recorded}
        awards={awards}
        tierBands={tierBands}
      />
    </>
  );
}
