import Link from 'next/link';
import LocalTime from '@/components/LocalTime';

// Onboarding checklist shown at the top of /profile. Replaces the manual "welcome DM"
// a mod used to send every new member: it renders on first login (?welcome=1, set by the
// OAuth callback for brand-new users) and keeps showing organically until the user has a
// verified account — the gate for event sign-ups.
//
// Server-rendered from props; all queries live in page.tsx.

export interface GettingStartedProps {
  clanName: string;
  welcomeParam: boolean;
  accountState: 'none' | 'unverified' | 'verified';
  verifiedRsns: string[];
  unverifiedRsns: string[];
  isRosterMember: boolean;
  activeWeeklies: { id: number; title: string; enrolled: boolean }[];
  nextWeekly: { id: number; title: string; startDate: string } | null;
  signupOpenEvents: { id: number; name: string; mySignupStatus: string | null }[];
  liveEvents: { id: number; name: string }[];
}

function StepBadge({ done, n }: { done: boolean; n: number }) {
  return done ? (
    <span className="w-6 h-6 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center text-sm shrink-0 mt-0.5">
      ✓
    </span>
  ) : (
    <span className="w-6 h-6 rounded-full bg-gold/15 text-gold flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
      {n}
    </span>
  );
}

export default function GettingStarted(props: GettingStartedProps) {
  const {
    clanName,
    welcomeParam,
    accountState,
    verifiedRsns,
    unverifiedRsns,
    isRosterMember,
    activeWeeklies,
    nextWeekly,
    signupOpenEvents,
    liveEvents,
  } = props;

  const accountDone = accountState === 'verified';
  const weeklyDone = activeWeeklies.some((w) => w.enrolled);
  const signedUpEvents = signupOpenEvents.filter(
    (e) => e.mySignupStatus === 'pending' || e.mySignupStatus === 'approved',
  );
  const openToJoin = signupOpenEvents.filter(
    (e) => e.mySignupStatus !== 'pending' && e.mySignupStatus !== 'approved',
  );
  const bingoDone = signupOpenEvents.length > 0 && openToJoin.length === 0;

  return (
    <section className="border border-gold/30 bg-gold/5 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="text-lg font-semibold">Welcome to {clanName}!</h2>
        </div>
        {welcomeParam && (
          <Link
            href="/profile"
            className="text-xs text-text-muted hover:text-foreground shrink-0"
          >
            Dismiss
          </Link>
        )}
      </div>
      <p className="text-sm text-text-muted mb-5">
        Here&rsquo;s everything to get set up — it only takes a couple of minutes.
      </p>

      <ol className="space-y-4">
        {/* Step 1 — link an account */}
        <li className="flex gap-3">
          <StepBadge done={accountDone} n={1} />
          <div className="min-w-0">
            <div className="font-medium">Link your RuneScape account</div>
            {accountState === 'verified' ? (
              <p className="text-sm text-text-muted">
                You&rsquo;re linked as <span className="text-foreground">{verifiedRsns.join(', ')}</span>.
                Add alts any time below.
              </p>
            ) : accountState === 'unverified' ? (
              <p className="text-sm text-text-muted">
                <span className="text-foreground">{unverifiedRsns.join(', ')}</span>{' '}
                {unverifiedRsns.length === 1 ? 'is' : 'are'} linked but not verified yet — finish
                verification below. Event sign-ups need a verified account.
              </p>
            ) : (
              <p className="text-sm text-text-muted">
                Easiest way: paste the plugin token below into the Anvil RuneLite plugin and just
                play. On mobile or the official client, use the manual options at the bottom of
                this page.
              </p>
            )}
          </div>
        </li>

        {/* Step 2 — weekly competitions */}
        <li className="flex gap-3">
          <StepBadge done={weeklyDone} n={2} />
          <div className="min-w-0">
            <div className="font-medium">Weekly competitions (SOTW / BOTW)</div>
            {activeWeeklies.length > 0 ? (
              weeklyDone ? (
                <p className="text-sm text-text-muted">
                  You&rsquo;re being tracked in{' '}
                  {activeWeeklies
                    .filter((w) => w.enrolled)
                    .map((w, i, arr) => (
                      <span key={w.id}>
                        <Link href={`/weekly/${w.id}`} className="text-gold hover:underline underline-offset-2">
                          {w.title}
                        </Link>
                        {i < arr.length - 1 && ', '}
                      </span>
                    ))}{' '}
                  — nothing to do, your gains count automatically.
                </p>
              ) : isRosterMember ? (
                <p className="text-sm text-text-muted">
                  Clan members are entered automatically — you&rsquo;ll appear on the{' '}
                  <Link href="/weekly" className="text-gold hover:underline underline-offset-2">
                    leaderboard
                  </Link>{' '}
                  at the next update. No sign-up needed.
                </p>
              ) : (
                <p className="text-sm text-text-muted">
                  Clan members are entered automatically — once your RSN is in the in-game clan,
                  you&rsquo;ll be tracked in the{' '}
                  <Link href="/weekly" className="text-gold hover:underline underline-offset-2">
                    current competition
                  </Link>{' '}
                  with no sign-up needed.
                </p>
              )
            ) : nextWeekly ? (
              <p className="text-sm text-text-muted">
                <Link href={`/weekly/${nextWeekly.id}`} className="text-gold hover:underline underline-offset-2">
                  {nextWeekly.title}
                </Link>{' '}
                starts <LocalTime date={nextWeekly.startDate} format="date" />. Clan members are
                entered automatically — no sign-up needed.
              </p>
            ) : (
              <p className="text-sm text-text-muted">
                Nothing running right now — new competitions are announced in Discord, and clan
                members are entered automatically.
              </p>
            )}
          </div>
        </li>

        {/* Step 3 — bingo events */}
        <li className="flex gap-3">
          <StepBadge done={bingoDone} n={3} />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Bingo events</div>
            {signupOpenEvents.length > 0 ? (
              <div className="space-y-2 mt-1">
                {signedUpEvents.map((e) => (
                  <p key={e.id} className="text-sm text-text-muted">
                    You&rsquo;re signed up for{' '}
                    <Link href={`/events/${e.id}`} className="text-gold hover:underline underline-offset-2">
                      {e.name}
                    </Link>
                    {e.mySignupStatus === 'pending' && ' (pending review)'}.
                  </p>
                ))}
                {openToJoin.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-text-muted min-w-0">
                      Sign-ups are open for <span className="text-foreground">{e.name}</span>
                      {!accountDone && ' — verify your account first (step 1)'}
                    </p>
                    <Link
                      href={`/events/${e.id}/signup`}
                      className="text-xs px-2.5 py-1.5 border border-gold/40 text-gold rounded-lg hover:bg-gold/10 transition-colors shrink-0"
                    >
                      Sign up →
                    </Link>
                  </div>
                ))}
              </div>
            ) : liveEvents.length > 0 ? (
              <p className="text-sm text-text-muted">
                {liveEvents.map((e, i) => (
                  <span key={e.id}>
                    <Link href={`/events/${e.id}`} className="text-gold hover:underline underline-offset-2">
                      {e.name}
                    </Link>
                    {i < liveEvents.length - 1 && ', '}
                  </span>
                ))}{' '}
                {liveEvents.length === 1 ? 'is' : 'are'} underway — sign-ups have closed, but you
                can follow the boards. New events are announced in Discord.
              </p>
            ) : (
              <p className="text-sm text-text-muted">
                No sign-ups open right now — new events are announced in Discord and on the{' '}
                <Link href="/" className="text-gold hover:underline underline-offset-2">
                  home page
                </Link>
                .
              </p>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}
