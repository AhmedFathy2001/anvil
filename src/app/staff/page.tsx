
import { platformTotals, multiClanPeople, nameCollisions } from '@/lib/platformView';
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
  const [t, multi, collisions] = await Promise.all([
    platformTotals(),
    multiClanPeople(10),
    nameCollisions(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Platform</h1>
      <p className="mt-1 text-sm text-gray-400">
        Every clan on this deployment. Nothing here is scoped to one.
      </p>

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
