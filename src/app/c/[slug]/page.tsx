import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexClan } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';

export const dynamic = 'force-dynamic';

/**
 * A clan, seen from the apex.
 *
 * Browsing the platform should not bounce you between hostnames: you are on the directory, you
 * click a clan, you stay here. What you can DO still lives on the clan's own site — this page links
 * across for that rather than trying to be it, because a clan's pages take their clan from the Host
 * header and re-addressing them by path would mean every link and every fetch in the app having to
 * know which mode it is in.
 *
 * So the split is: browsing never leaves the apex, acting goes to the clan.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const clan = await apexClan((await params).slug);
  return clan ? { title: `${clan.name} — Anvil` } : { title: 'Not found — Anvil' };
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="text-2xl font-semibold text-gold">{value}</div>
      <div className="text-sm text-gray-300">{label}</div>
    </div>
  );
}

export default async function ApexClanPage({ params }: { params: Promise<{ slug: string }> }) {
  // Apex only. On a clan's own host this path would be a second address for a page that already has
  // one, which is the dual-addressing this design exists to avoid.
  if (!isApexHost((await headers()).get('host'))) notFound();

  const clan = await apexClan((await params).slug);
  if (!clan) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/clans" className="text-sm text-gray-400 hover:text-gold">
        ← All clans
      </Link>

      <h1 className="mt-3 text-3xl font-bold">{clan.name}</h1>
      {clan.inGameName && clan.inGameName !== clan.name && (
        <p className="mt-1 text-sm text-gray-400">
          In game: <span className="text-gray-300">{clan.inGameName}</span>
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Members" value={clan.members} />
        <Stat label="Guests" value={clan.guests} />
        <Stat label="Events run" value={clan.eventsRun} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-5 w-1 bg-gold" />
          <h2 className="text-lg font-semibold">Running now</h2>
        </div>
        {clan.liveEvents.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-gray-400">
            Nothing live at the moment.
          </p>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {clan.liveEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <a href={`https://${clan.host}/events/${e.id}`} className="hover:text-gold">
                  {e.name}
                </a>
                {e.endDate && (
                  <span className="shrink-0 text-xs text-gray-500">
                    until {e.endDate.replace('T', ' ').slice(0, 16)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={`https://${clan.host}`}
          className="rounded-xl border border-gold/40 px-5 py-2.5 text-sm text-gold"
        >
          Go to {clan.name}
        </a>
        <a
          href={`https://${clan.host}/events`}
          className="rounded-xl border border-card-border px-5 py-2.5 text-sm text-gray-300"
        >
          Their events
        </a>
      </div>

      <p className="mt-6 text-xs text-gray-600">{clan.host}</p>
    </div>
  );
}
