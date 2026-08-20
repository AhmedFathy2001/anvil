import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexPerson } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * One PERSON — the human, who plays characters.
 *
 * Keyed by id rather than a name because a person has no unique one: display names collide, and an
 * RSN names a character, which is what /p/ is for. "Ahmed" is a user; "Drenvox mdps" is one of the
 * accounts they play.
 *
 * Lists only their SHARED characters, because the apex is nobody's clan and the visibility rule
 * therefore reduces to sharing alone. Somebody who has published nothing is a 404 rather than a
 * page with their name and an empty list — the empty list would itself say something about them.
 */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const person = await apexPerson(Number((await params).id));
  return person ? { title: `${person.displayName ?? 'Player'} — Anvil` } : { title: 'Not found — Anvil' };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const person = await apexPerson(id);
  if (!person) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{person.displayName ?? `Player #${person.playerId}`}</h1>
      <p className="mt-1 text-sm text-gray-400">
        {person.characters.length} shared {person.characters.length === 1 ? 'character' : 'characters'}
      </p>

      <ul className="mt-6 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
        {person.characters.map((c) => (
          <li key={c.rsn} className="flex items-center justify-between gap-3 px-4 py-3">
            <ClanLink href={`/p/${encodeURIComponent(c.rsn)}`} className="hover:text-gold">
              {c.rsn}
            </ClanLink>
            <span className="shrink-0 text-sm text-gray-400">{c.clan ?? '—'}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-gray-600">
        Only shared characters appear here. Anything else this person plays is between them and the
        clans they&rsquo;re in.
      </p>
    </div>
  );
}
