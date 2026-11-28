import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { practiceBoardInClan } from '@/lib/practice';
import { practiceAllowedForPlan } from '@/lib/practiceRules';
import { idParam } from '@/lib/routeIds';
import EventTilesPage from '@/app/admin/events/[eventId]/tiles/page';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Practice board tiles', robots: { index: false, follow: false } };

/**
 * The ordinary tile editor, on a practice board (lib/practice) — every tile kind, combos, races and
 * missions, authored exactly as a real board's are, so what gets tested is the real thing.
 *
 * It lives HERE and not under /admin/events/<id>/tiles because that route's layout carries the whole
 * event admin (co-hosts, sign-ups, Discord, money, publishing), none of which a practice board has,
 * and sends a practice board away. This page opens practice boards only, for this clan's admins only
 * (the same people who manage the board); a real board's id 404s, so it is no way around that layout.
 */
export default async function PracticeTilesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin') || !practiceAllowedForPlan(clan.plan)) notFound();
  const { eventId } = await params;
  const found = await practiceBoardInClan(clan.id, idParam(eventId));
  if (!found) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs text-text-muted">Practice board</div>
          <h1 className="text-2xl font-bold">{found.event.name}</h1>
        </div>
        <ClanLink
          href={`/events/practice/${found.event.id}`}
          className="h-9 px-3 inline-flex items-center rounded-lg border border-card-border text-sm hover:border-gold/60"
        >
          Back to the practice board
        </ClanLink>
      </div>
      <p className="text-sm text-text-muted">
        The same editor a real event uses, unlocked while the board runs. Nothing here leaves the practice board.
      </p>
      <EventTilesPage params={Promise.resolve({ eventId: String(found.event.id) })} />
    </div>
  );
}
