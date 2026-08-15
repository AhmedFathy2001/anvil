import Link from 'next/link';
import TimeLeft from './TimeLeft';
import type { LockerLiveEvent, LockerLiveWeekly, LockerSignup } from '@/lib/profileLocker';

// What's running for this member right now: their board, their weekly placing, and anything still
// open to join. Ordered by what they can act on — a sign-up that closes tomorrow matters more than
// a board they're already on.

interface Props {
  events: LockerLiveEvent[];
  weeklies: LockerLiveWeekly[];
  signups: LockerSignup[];
  connected: boolean;
}

export default function LiveForYou({ events, weeklies, signups, connected }: Props) {
  const count = events.length + weeklies.length + signups.length;

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-semibold">Live for you</h2>
        <span className="ml-auto text-xs text-text-muted">
          {count === 0 ? 'nothing running' : `${count} thing${count === 1 ? '' : 's'} running`}
        </span>
      </div>

      {count === 0 ? (
        <div className="border border-dashed border-card-border rounded-lg bg-brown-dark/40 px-4 py-6 text-center text-sm text-text-muted">
          <div className="font-medium text-foreground mb-1">Nothing running for you yet.</div>
          {connected
            ? 'Sign-ups, your team board and your weekly placing all land here when they open.'
            : 'Connect the plugin above — sign-ups, your team board and your weekly placing all land here.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((e) => (
            <EventRow key={e.eventId} event={e} />
          ))}
          {weeklies.map((w) => (
            <WeeklyRow key={w.id} weekly={w} />
          ))}
          {signups.map((s) => (
            <SignupRow key={s.eventId} signup={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ children, href }: { children: React.ReactNode; href?: string }) {
  const className =
    'block border border-card-border rounded-lg bg-brown-dark/40 px-3.5 py-3 transition-colors';
  return href ? (
    <Link href={href} className={`${className} hover:border-gold/40 hover:bg-card-bg-hover`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

function EventRow({ event }: { event: LockerLiveEvent }) {
  const pct = event.total > 0 ? Math.min(100, Math.round((event.score / event.total) * 100)) : 0;
  return (
    <Row>
      <div className="flex items-center gap-2.5 flex-wrap">
        {event.team && (
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: event.team.color }} />
        )}
        <Link href={`/events/${event.eventId}`} className="font-semibold hover:text-gold-light">
          {event.name}
        </Link>
        {event.team && (
          <Link
            href={`/events/${event.eventId}/teams/${event.team.id}`}
            className="text-sm text-text-muted hover:text-foreground"
          >
            · {event.team.name}
          </Link>
        )}
        <span className="ml-auto flex items-center gap-2">
          {event.status === 'upcoming' ? (
            <TimeLeft
              until={event.startDate}
              prefix="starts in"
              suffix=""
              className="font-mono text-xs text-text-muted border border-card-border rounded-full px-2.5 py-0.5"
            />
          ) : (
            <TimeLeft
              until={event.endDate}
              className="font-mono text-xs font-bold text-orange-400 border border-orange-400/30 bg-orange-400/10 rounded-full px-2.5 py-0.5"
            />
          )}
          {event.status === 'live' && event.playerToken && (
            <Link
              href={`/player/${event.playerToken}`}
              className="text-xs font-semibold px-2.5 py-1.5 border border-gold/30 text-gold hover:bg-gold/10 rounded-lg transition-colors"
            >
              Dashboard →
            </Link>
          )}
        </span>
      </div>

      {event.status === 'upcoming' ? (
        <div className="mt-1.5 text-[12.5px] text-text-muted">
          You&rsquo;re in{event.team ? ` on ${event.team.name}` : ' — your team lands when the draft runs'}. The
          board opens when it starts.
        </div>
      ) : event.team ? (
        <>
          <div className="mt-2.5 h-1.5 rounded-full bg-brown-light overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--gold-dark), var(--gold-light))' }}
            />
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-[11.5px] text-text-muted flex-wrap">
            <span>
              Team board <b className="font-mono text-foreground">{Math.round(event.score)}/{event.total}</b>{' '}
              {event.unit}
              {event.rank && (
                <>
                  {' '}· rank <b className="font-mono text-foreground">{event.rank}</b> of {event.teamsTotal}
                </>
              )}
            </span>
            <span>
              You completed <b className="font-mono text-foreground">{event.myTasks}</b>
              {event.myPoints > 0 && (
                <>
                  {' '}· <b className="font-mono text-foreground">{event.myPoints.toLocaleString()}</b> pts
                </>
              )}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-1.5 text-[12.5px] text-text-muted">
          You&rsquo;re signed up — you&rsquo;ll get a team when the draft runs.
        </div>
      )}
    </Row>
  );
}

function WeeklyRow({ weekly }: { weekly: LockerLiveWeekly }) {
  return (
    <Row href={`/weekly/${weekly.id}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        {weekly.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={weekly.iconUrl} alt="" width={18} height={18} className="shrink-0" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-sm bg-gold shrink-0" />
        )}
        <span className="font-semibold">{weekly.title}</span>
        <TimeLeft
          until={weekly.endDate}
          className="ml-auto font-mono text-xs text-text-muted border border-card-border rounded-full px-2.5 py-0.5"
        />
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[12.5px] text-text-muted flex-wrap">
        <span>
          {weekly.rank ? (
            <>
              You&rsquo;re <b className="font-mono text-foreground">#{weekly.rank}</b> of {weekly.entrants}
            </>
          ) : (
            <>Entered — nothing gained yet</>
          )}
        </span>
        <span>
          <b className="font-mono text-foreground">{compact(weekly.gained)}</b> {weekly.kind === 'BOTW' ? 'KC' : 'XP'}
          {weekly.behind != null && weekly.behind > 0 && (
            <>
              {' '}· <b className="font-mono text-foreground">{compact(weekly.behind)}</b> behind{' '}
              {weekly.rank ? `${weekly.rank - 1}${ordinal(weekly.rank - 1)}` : 'the next place'}
            </>
          )}
        </span>
      </div>
    </Row>
  );
}

function SignupRow({ signup }: { signup: LockerSignup }) {
  const joined = signup.myStatus === 'pending' || signup.myStatus === 'approved';
  return (
    <Row>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-sm bg-accent-green-light shrink-0" />
        <Link href={`/events/${signup.eventId}`} className="font-semibold hover:text-gold-light">
          {signup.name}
        </Link>
        <span className="text-sm text-text-muted">
          ·{' '}
          {joined
            ? signup.myStatus === 'pending'
              ? 'sign-up sent, pending review'
              : "you're in"
            : 'sign-ups open'}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <TimeLeft
            until={signup.closesAt}
            prefix="closes in"
            suffix=""
            className="font-mono text-xs text-text-muted border border-card-border rounded-full px-2.5 py-0.5"
          />
          {!joined && (
            <Link
              href={`/events/${signup.eventId}/signup`}
              className="text-xs font-semibold px-3 py-1.5 bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors"
            >
              Sign up
            </Link>
          )}
        </span>
      </div>
    </Row>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

// XP gains run to seven digits and a weekly row has two of them; a KC is three digits and reads
// worse abbreviated. Compact above ten thousand, exact below it.
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}
