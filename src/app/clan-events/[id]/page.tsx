import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import { verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { requireClan } from '@/lib/clanContext';
import { getClanEvent } from '@/lib/clanEvents';
import { idParam } from '@/lib/routeIds';

import GoingButton from './GoingButton';

export const dynamic = 'force-dynamic';

/** One clan event (lib/clanEvents): when and where its next occurrence is, who's going, and "I'm going". */
export default async function ClanEventPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  const [clan, user] = await Promise.all([requireClan(), verifyUser()]);
  if (!(await canSeeClan({ clanId: clan.id, visibility: clan.visibility, playerId: user?.playerId, userId: user?.userId }))) notFound();
  const ev = await getClanEvent(clan.id, id, user?.userId ?? null);
  if (!ev) notFound();
  const member = user != null && (await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: user.playerId, userId: user.userId }));
  const where = [ev.location, ev.world ? `World ${ev.world}` : null].filter(Boolean).join(' · ');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <ClanLink href="/events" className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-gold">
        &larr; Events
      </ClanLink>
      <article className="rounded-xl border border-card-border bg-card-bg p-6">
        <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">
          Clan event{ev.repeat === 'weekly' ? ' · every week' : ''}
          {ev.phase === 'live' && <span className="ml-2 rounded bg-accent-green/15 px-1.5 py-0.5 normal-case text-accent-green">Live now</span>}
        </p>
        <h1 className="mb-4 text-2xl font-bold text-gold">{ev.title}</h1>
        <dl className="mb-4 grid grid-cols-[90px_1fr] gap-y-2 text-sm">
          <dt className="text-text-muted">When</dt>
          <dd>
            <LocalTime date={ev.occurrence.start} /> – <LocalTime date={ev.occurrence.end} format="time" />
          </dd>
          {where && (
            <>
              <dt className="text-text-muted">Where</dt>
              <dd>{where}</dd>
            </>
          )}
          {ev.host && (
            <>
              <dt className="text-text-muted">Host</dt>
              <dd>{ev.host}</dd>
            </>
          )}
        </dl>
        {ev.description && <p className="mb-5 whitespace-pre-line text-sm text-foreground/90">{ev.description}</p>}
        <GoingButton id={ev.id} initialGoing={ev.mine} initialCount={ev.going} canSay={member} signedIn={user != null} />
        {ev.goingNames.length > 0 && <p className="mt-3 text-sm text-text-muted">Going: {ev.goingNames.join(', ')}{ev.going > ev.goingNames.length ? ` +${ev.going - ev.goingNames.length}` : ''}</p>}
      </article>
    </main>
  );
}
