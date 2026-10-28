import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import { verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { requireClan } from '@/lib/clanContext';
import { keyFor } from '@/lib/clanEventModules';
import { loadQuestions } from '@/lib/clanEventQuestions';
import { mySignup, seatsFor } from '@/lib/clanEventSignups';
import { getClanEvent } from '@/lib/clanEvents';
import { idParam } from '@/lib/routeIds';

import GoingButton from './GoingButton';
import SignupPanel from './SignupPanel';

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
  const m = ev.modules;
  const key = keyFor(m, ev, ev.occurrence);
  const [questions, seats, mine] = m.signups.on
    ? await Promise.all([
        loadQuestions(clan.id, ev.id, 'signup'),
        member ? seatsFor(clan.id, user!.playerId) : Promise.resolve([]),
        member ? mySignup(clan.id, ev.id, key, user!.userId) : Promise.resolve(null),
      ])
    : [[], [], null];
  const count = ev.signup ? `${ev.going}${ev.signup.cap != null ? `/${ev.signup.cap}` : ''} signed up` : `${ev.going} going`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <ClanLink href="/events" className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-gold">
        &larr; Events
      </ClanLink>
      <article className="rounded-xl border border-card-border bg-card-bg p-6">
        <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">
          Clan event{ev.repeat === 'weekly' ? ' · every week' : ''}
          {ev.phase === 'live' && <span className="ml-2 rounded bg-accent-green/15 px-1.5 py-0.5 normal-case text-accent-green">Live now</span>}
          {ev.phase === 'ended' && <span className="ml-2 rounded bg-text-muted/15 px-1.5 py-0.5 normal-case text-text-muted">Ended</span>}
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
          {m.fee.on && (
            <>
              <dt className="text-text-muted">Entry</dt>
              <dd>{m.fee.amount.toLocaleString()} gp</dd>
            </>
          )}
          {m.payouts.on && m.payouts.addedGp > 0 && (
            <>
              <dt className="text-text-muted">Prizes</dt>
              <dd>{m.payouts.addedGp.toLocaleString()} gp{m.fee.on ? ' + the entry fees' : ''}</dd>
            </>
          )}
        </dl>
        {ev.description && <p className="mb-5 whitespace-pre-line text-sm text-foreground/90">{ev.description}</p>}
        {ev.signup ? (
          <>
            <p className="mb-3 text-sm text-text-muted">{count}</p>
            <SignupPanel
              id={ev.id}
              open={ev.signup.open}
              reason={ev.signup.reason}
              canSign={member}
              signedIn={user != null}
              questions={questions}
              seats={seats}
              mine={mine ? { status: mine.status, clanMemberId: mine.clanMemberId, answers: mine.answers, feeStatus: mine.feeStatus, feeAmount: mine.feeAmount } : null}
              approval={m.signups.approval}
            />
          </>
        ) : ev.phase !== 'ended' ? (
          <GoingButton id={ev.id} initialGoing={ev.mine} initialCount={ev.going} canSay={member} signedIn={user != null} />
        ) : null}
        {ev.goingNames.length > 0 && (
          <p className="mt-3 text-sm text-text-muted">
            {ev.signup ? 'Signed up' : 'Going'}: {ev.goingNames.join(', ')}
            {ev.going > ev.goingNames.length ? ` +${ev.going - ev.goingNames.length}` : ''}
          </p>
        )}
        {ev.surveyOpen && member && (
          <ClanLink href={`/clan-events/${ev.id}/survey`} className="mt-4 inline-block rounded border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
            Answer the survey
          </ClanLink>
        )}
      </article>
    </main>
  );
}
