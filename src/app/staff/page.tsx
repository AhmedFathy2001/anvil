import Link from 'next/link';

import { platformTotals, multiClanPeople } from '@/lib/platformView';

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
  const [t, multi] = await Promise.all([platformTotals(), multiClanPeople(10)]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Platform</h1>
      <p className="mt-1 text-sm text-gray-400">
        Every clan on this deployment. Nothing here is scoped to one.
      </p>

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
                <Link href={`/staff/people?q=${encodeURIComponent(p.name ?? '')}`} className="hover:text-gold">
                  {p.name ?? `Person #${p.playerId}`}
                </Link>
                <span className="text-sm text-gray-400">{p.clans} clans</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
