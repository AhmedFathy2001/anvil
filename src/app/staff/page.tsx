
import { platformTotals, multiClanPeople, nameCollisions, allClans } from '@/lib/platformView';
import { billingStatus, liveness, QUIET_SYNC_DAYS, TRIAL_WARN_DAYS } from '@/lib/clanBilling';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="text-2xl font-semibold text-gold">{value}</div>
      <div className="text-sm text-gray-300">{label}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * The platform overview.
 *
 * The two numbers that matter here could not be produced at all under one-database-per-clan, and
 * they are the ones stated most plainly: how many PEOPLE use this (a human in four clans is one),
 * and how many of them are in more than one clan. The second is also the cheapest possible check
 * that the identity remodel merged rather than duplicated — if it were broken, it would read zero.
 */
export default async function StaffOverview() {
  const [t, multi, collisions, clans] = await Promise.all([
    platformTotals(),
    multiClanPeople(10),
    nameCollisions(),
    allClans(),
  ]);

  // WHAT IS WAITING ON A PERSON, as opposed to what the numbers say. Every one of these is a state a
  // clan can sit in indefinitely without anything failing: The AFK Spot had no owner for weeks and
  // nothing said so, because nothing was looking. A dashboard of totals is a report; this is the
  // part that is a tool.
  const ownerless = clans.filter((c) => c.status === 'active' && !c.owner);
  const unverified = clans.filter((c) => c.status === 'active' && !c.verified);
  const overCap = clans.filter((c) => c.memberCap != null && c.members > c.memberCap);

  // MONEY, WHICH THIS PAGE COULD NOT SEE. Every one of these facts was already on the clan row and
  // read by nothing but the customer's own /portal. Ownerless and unverified are states a clan sits
  // in until somebody notices; a trial running out on Thursday is the same kind of state, and it is
  // the one this business is actually made of.
  const now = Date.now();
  const active = clans.filter((c) => c.status === 'active');
  const billed = active.map((c) => ({ clan: c, billing: billingStatus(c, now) }));
  const trialEnding = billed
    .filter((b) => b.billing.state === 'trialing' && b.billing.attention)
    .sort((a, b) => (a.billing.daysLeft ?? 0) - (b.billing.daysLeft ?? 0));
  const cancelling = billed.filter((b) => b.billing.state === 'cancelling');
  const lapsed = billed.filter((b) => b.billing.state === 'lapsed');
  const trialOver = billed.filter((b) => b.billing.state === 'trial-expired');
  // A clan nothing has arrived from in a month. Never-synced clans are excluded by `liveness` —
  // they are new or unverified, and both already have a line of their own above.
  const quiet = active.filter((c) => liveness(c, now).quiet);

  return (
    <div>
      <h1 className="text-2xl font-bold">Platform</h1>
      <p className="mt-1 text-sm text-gray-400">
        Every clan on this deployment. Nothing here is scoped to one.
      </p>

      {(ownerless.length > 0 ||
        unverified.length > 0 ||
        overCap.length > 0 ||
        trialEnding.length > 0 ||
        cancelling.length > 0 ||
        lapsed.length > 0 ||
        trialOver.length > 0 ||
        quiet.length > 0) && (
        <Section title="Needs a look">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Money first — it is the half of this page that has a deadline on it. */}
            <Attention
              title={`Trial ends within ${TRIAL_WARN_DAYS} days`}
              blurb="The window to have a conversation, and it closes on its own."
              clans={trialEnding.map((b) => b.clan)}
              note={(c) => billingStatus(c, now).label}
              tone="warn"
            />
            <Attention
              title="Cancelling"
              blurb="Still paid up and still served — which is why it is worth a message now."
              clans={cancelling.map((b) => b.clan)}
              note={(c) => billingStatus(c, now).label}
              tone="warn"
            />
            <Attention
              title="Renewal overdue"
              blurb="A subscription whose period end went by. Usually a failed payment."
              clans={lapsed.map((b) => b.clan)}
              note={(c) => billingStatus(c, now).label}
              tone="bad"
            />
            <Attention
              title="Trial ended, never paid"
              blurb="They fell back to free. Nothing is broken; nothing asked them either."
              clans={trialOver.map((b) => b.clan)}
              note={(c) => billingStatus(c, now).label}
            />
            <Attention
              title={`No roster sync in ${QUIET_SYNC_DAYS} days`}
              blurb="Nobody here is running the plugin, so everything downstream of the roster is stale."
              clans={quiet}
              note={(c) => {
                const d = liveness(c, now).syncDays;
                return d == null ? '' : `${d} days quiet`;
              }}
            />
            <Attention
              title="No owner"
              blurb="Its own transfer flow needs a current owner, so it cannot fix this itself."
              clans={ownerless}
            />
            <Attention
              title="Unverified"
              blurb="Nobody has proved the in-game clan is theirs — it cannot sync a roster."
              clans={unverified}
            />
            <Attention
              title="Over its seat cap"
              blurb="Nothing is blocked; the cap is a number to revisit, not a door."
              clans={overCap}
            />
          </div>
        </Section>
      )}

      {/* FIRST, AND ONLY WHEN THERE IS ONE. A disputed name is the single thing on this surface
          that is waiting on a person: S6 refuses the second claimant and tells them to come here,
          and until now there was nothing here to come to. Everything below is a number to read. */}
      {collisions.length > 0 && (
        <Section title="Disputed in-game names">
          <div className="flex flex-col gap-3">
            {collisions.map((c) => (
              <div key={c.inGameName} className="rounded-xl border border-accent-red/40 bg-accent-red/[0.06] p-4">
                <div className="text-sm">
                  <span className="text-gray-400">Two clans claim </span>
                  <span className="font-medium text-gold">{c.inGameName}</span>
                </div>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {c.clans.map((cl) => (
                    <li key={cl.id} className="flex flex-wrap items-baseline gap-x-2.5 text-sm">
                      <ClanLink href={`/c/${cl.slug}`} className="text-gold hover:underline">
                        {cl.name}
                      </ClanLink>
                      {cl.verified ? (
                        <span className="text-xs text-emerald-400">holds it</span>
                      ) : (
                        <span className="text-xs text-gray-500">unverified</span>
                      )}
                      {cl.refusedAttempts > 0 && (
                        <span className="text-xs text-gray-500">
                          {cl.refusedAttempts} refused claim{cl.refusedAttempts === 1 ? '' : 's'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-xs text-gray-500">
                  Decide it on the Clans tab — verify the right one by hand, or withdraw the badge.
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Reach">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="People" value={t.people} hint="humans, counted once each" />
          <Stat label="OSRS accounts" value={t.accounts} hint="mains and alts" />
          <Stat label="Roster seats" value={t.seats} hint="account × clan, currently active" />
          <Stat label="Discord logins" value={t.logins} />
        </div>
      </Section>

      <Section title="Clans">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active" value={t.activeClans} />
          <Stat label="Suspended" value={t.suspendedClans} hint="resolves, refuses writes" />
          <Stat label="Archived" value={t.archivedClans} hint="read-only history" />
          <Stat label="Total" value={t.clans} />
        </div>
      </Section>

      <Section title="Activity">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Events" value={t.events} />
          <Stat label="Weekly competitions" value={t.competitions} />
          <Stat label="Platform-banned" value={t.bannedPeople} hint="barred everywhere" />
          <Stat label="Platform staff" value={t.platformStaff} />
        </div>
      </Section>

      <Section title="People in more than one clan">
        {multi.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-gray-400">
            Nobody yet. This fills in as people turn up in a second clan — and it is the quickest
            sign that one person is being recognised as one person, rather than duplicated per clan.
          </p>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {multi.map((p) => (
              <li key={p.playerId} className="flex items-center justify-between px-4 py-2.5">
                <ClanLink href={`/staff/people?q=${encodeURIComponent(p.name ?? '')}`} className="hover:text-gold">
                  {p.name ?? `Person #${p.playerId}`}
                </ClanLink>
                <span className="text-sm text-gray-400">{p.clans} clans</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

const ATTENTION_TONE = {
  plain: 'border-card-border',
  warn: 'border-yellow-500/40',
  bad: 'border-accent-red/40',
} as const;

/**
 * One column of the "needs a look" grid. Renders nothing when its list is empty.
 *
 * Each clan links to its OWN operator page rather than to the clan's public home. The public home
 * is where a member goes; from here the next thing wanted is always the same — what is going on
 * with this one — and that is what /staff/clans/<id> answers.
 */
function Attention<T extends { id: number; slug: string; name: string }>({
  title,
  blurb,
  clans,
  note,
  tone = 'plain',
}: {
  title: string;
  blurb: string;
  clans: T[];
  /** A few words after the name — how long is left, how long it has been quiet. */
  note?: (clan: T) => string;
  tone?: keyof typeof ATTENTION_TONE;
}) {
  if (clans.length === 0) return null;
  return (
    <div className={`rounded-xl border bg-card-bg p-4 ${ATTENTION_TONE[tone]}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs tabular-nums text-gold">{clans.length}</span>
      </div>
      <p className="mt-1 text-xs text-text-muted">{blurb}</p>
      <ul className="mt-2.5 flex flex-col gap-1">
        {clans.map((c) => {
          const said = note?.(c);
          return (
            <li key={c.id} className="flex items-baseline justify-between gap-2">
              <ClanLink href={`/staff/clans/${c.id}`} className="text-xs text-gold hover:underline truncate">
                {c.name}
              </ClanLink>
              {said && <span className="shrink-0 text-[11px] tabular-nums text-text-muted">{said}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
