import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import EventTimer from '@/components/EventTimer';
import LocalTime from '@/components/LocalTime';
import { verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { requireClan } from '@/lib/clanContext';
import { creatorPublicAway } from '@/lib/creatorGuard';
import { CHANNEL_SLOT_LABELS, channelList } from '@/lib/clanEventChannels';
import { keyFor } from '@/lib/clanEventModules';
import { loadQuestions } from '@/lib/clanEventQuestions';
import { mySignup, seatsFor } from '@/lib/clanEventSignups';
import { getClanEvent } from '@/lib/clanEvents';
import { clanGuildId } from '@/lib/discord-roles';
import { idParam } from '@/lib/routeIds';

import GoingButton from './GoingButton';
import SignupPanel from './SignupPanel';
import { displayImageUrl } from '@/lib/displayImageServer';

export const dynamic = 'force-dynamic';

/** One clan event (lib/clanEvents): when and where its next occurrence is, who's going, and "I'm going". */
export default async function ClanEventPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  const [clan, user] = await Promise.all([requireClan(), verifyUser()]);
  await creatorPublicAway('/clan-events', clan);
  if (!(await canSeeClan({ clanId: clan.id, visibility: clan.visibility, playerId: user?.playerId, userId: user?.userId }))) notFound();
  const ev = await getClanEvent(clan.id, id, user?.userId ?? null);
  if (!ev) notFound();
  const member = user != null && (await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: user.playerId, userId: user.userId }));
  const where = [ev.location, ev.world ? `World ${ev.world}` : null].filter(Boolean).join(' · ');
  const m = ev.modules;
  const channels = channelList(ev.channels);
  // A channel link needs the server it's in; without one the names still say where to go.
  const guildId = channels.length ? await clanGuildId(clan.id) : '';
  const key = keyFor(m, ev, ev.occurrence);
  const [questions, seats, mine] = m.signups.on
    ? await Promise.all([
        loadQuestions(clan.id, ev.id, 'signup'),
        member ? seatsFor(clan.id, user!.playerId) : Promise.resolve([]),
        member ? mySignup(clan.id, ev.id, key, user!.userId) : Promise.resolve(null),
      ])
    : [[], [], null];
  const count = ev.signup ? `${ev.going}${ev.signup.cap != null ? `/${ev.signup.cap}` : ''} signed up` : `${ev.going} going`;

  const prizes = m.payouts.on && m.payouts.addedGp > 0 ? `${m.payouts.addedGp.toLocaleString()} gp${m.fee.on ? ' + the entry fees' : ''}` : null;
  const action = ev.signup != null || (ev.phase !== 'ended' && m.rsvp);
  const chip = 'rounded-md border border-card-border px-2 py-0.5 text-xs text-foreground/80';
  const card = 'rounded-2xl border border-card-border bg-card-bg p-4 sm:p-5';
  const heading = 'flex items-center gap-2 text-lg font-bold';
  const facts: { label: string; value: React.ReactNode; note?: string | null }[] = [
    {
      label: 'When',
      value: (
        <>
          <LocalTime date={ev.occurrence.start} format="short" /> – <LocalTime date={ev.occurrence.end} format="time" />
        </>
      ),
      note: ev.repeat === 'weekly' ? 'every week' : null,
    },
    ...(where ? [{ label: 'Where', value: ev.world ? `World ${ev.world}` : ev.location, note: ev.world ? ev.location : null }] : []),
    ...(m.fee.on ? [{ label: 'Entry', value: `${m.fee.amount.toLocaleString()} gp` }] : []),
    ...(prizes ? [{ label: 'Prizes', value: <span className="text-gold-light">{prizes}</span> }] : []),
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <ClanLink href="/events" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-gold">
        &larr; Events
      </ClanLink>

      {/* The same header shape as a board or a competition, without the banner a clan event does not have. */}
      <header className={`${card} flex flex-wrap items-center justify-between gap-5`}>
        <div className="flex min-w-0 flex-[999_1_320px] items-center gap-4">
          {ev.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayImageUrl(ev.imageUrl)} alt="" className="h-[72px] w-[72px] shrink-0 rounded-2xl border-2 border-gold object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Clan event{ev.repeat === 'weekly' ? ' · every week' : ''}
              {ev.phase === 'live' && <span className="ml-2 text-accent-green">Live now</span>}
              {ev.phase === 'ended' && <span className="ml-2">Ended</span>}
            </p>
            <h1 className="mt-1 break-words text-2xl font-bold text-gold">{ev.title}</h1>
            {(ev.world || ev.location || ev.host) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {ev.world && <span className={chip}>World {ev.world}</span>}
                {!ev.world && ev.location && <span className={chip}>{ev.location}</span>}
                {ev.host && <span className={chip}>Hosted by {ev.host}</span>}
              </div>
            )}
          </div>
        </div>
        <EventTimer startDate={ev.occurrence.start} endDate={ev.occurrence.end} className="text-sm text-foreground/90" />
      </header>

      {/* The one thing to do here. An event with neither sign-ups nor "I'm going" has no bar. */}
      {action && (
        <section aria-label={ev.signup ? 'Sign up' : 'Going'} className="mt-4 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4 sm:p-5">
          {ev.signup ? (
            <>
              <p className="mb-3 text-base font-semibold">{count}</p>
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
          ) : (
            <GoingButton id={ev.id} initialGoing={ev.mine} initialCount={ev.going} canSay={member} signedIn={user != null} />
          )}
        </section>
      )}

      <div className={`mt-4 grid items-start gap-4 ${ev.goingNames.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <section aria-label="Details" className={card}>
          <h2 className={heading}>
            <span className="h-5 w-1 bg-gold" />
            Details
          </h2>
          {ev.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{ev.description}</p>}
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-xs text-text-muted">{f.label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold">{f.value}</dd>
                {f.note && <dd className="text-xs text-text-muted">{f.note}</dd>}
              </div>
            ))}
          </dl>
          {channels.length > 0 && (
            <div className="mt-4 border-t border-card-border pt-4">
              <div className="text-xs text-text-muted">Discord</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {channels.map(({ slot, channel }) => (
                  <a
                    key={slot}
                    href={guildId ? `https://discord.com/channels/${guildId}/${channel.id}` : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center text-gold hover:text-gold-light"
                  >
                    <span className="mr-1 text-text-muted">{CHANNEL_SLOT_LABELS[slot]}</span> {slot === 'voice' ? '🔊' : '#'}
                    {channel.name}
                  </a>
                ))}
              </div>
            </div>
          )}
          {ev.surveyOpen && member && (
            <ClanLink href={`/clan-events/${ev.id}/survey`} className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-gold px-4 text-sm font-semibold text-gold hover:bg-gold/10">
              Answer the survey
            </ClanLink>
          )}
        </section>

        {ev.goingNames.length > 0 && (
          <aside aria-label={ev.signup ? 'Signed up' : 'Going'} className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className={heading}>
                <span className="h-5 w-1 bg-gold" />
                Who&rsquo;s in
              </h2>
              <span className="text-xs tabular-nums text-text-muted">
                {ev.going}
                {ev.signup?.cap != null ? ` of ${ev.signup.cap}` : ''}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-card-border text-sm">
              {ev.goingNames.map((name) => (
                <li key={name} className="truncate py-2">
                  {name}
                </li>
              ))}
            </ul>
            {ev.going > ev.goingNames.length && <p className="mt-2 text-xs text-text-muted">and {ev.going - ev.goingNames.length} more</p>}
          </aside>
        )}
      </div>
    </main>
  );
}
