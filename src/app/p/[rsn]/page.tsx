import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexCharacter } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * One CHARACTER — an OSRS account, not the human behind it.
 *
 * The distinction is the identity model in the URL bar: /p/drenvox-mdps is a character, /u/<id> is
 * the person who plays it, and the old one-clan-per-database model had no way to tell them apart.
 *
 * Only shown when the account is shared. The apex holds no seat for anyone, so the visibility rule
 * — seat in the clan, or shared — leaves only the second half here. A page saying "this exists but
 * you may not see it" would disclose the very thing being withheld, so an unshared character is a
 * 404, indistinguishable from one that does not exist.
 */

export async function generateMetadata({ params }: { params: Promise<{ rsn: string }> }): Promise<Metadata> {
  const c = await apexCharacter(decodeURIComponent((await params).rsn));
  return c ? { title: `${c.rsn} — Anvil` } : { title: 'Not found — Anvil' };
}

export default async function CharacterPage({ params }: { params: Promise<{ rsn: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const character = await apexCharacter(decodeURIComponent((await params).rsn));
  if (!character) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{character.rsn}</h1>
      <p className="mt-1 text-sm text-gray-400">
        An OSRS account
        {character.owner && (
          <>
            {' '}played by{' '}
            <ClanLink href={`/u/${character.owner.playerId}`} className="text-gold hover:underline">
              {character.owner.displayName ?? 'someone on Anvil'}
            </ClanLink>
          </>
        )}
      </p>

      <div className="mt-6 space-y-2 rounded-xl border border-card-border bg-card-bg p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Clan</span>
          <span>
            {character.clan ? (
              <ClanLink href={`/c/${character.clan.slug}`} className="text-gold hover:underline">
                {character.clan.name}
              </ClanLink>
            ) : (
              <span className="text-gray-600">—</span>
            )}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Verified</span>
          <span className={character.verified ? 'text-emerald-400' : 'text-gray-500'}>
            {character.verified ? 'yes' : 'no'}
          </span>
        </div>
        {character.overallXp != null && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Total XP</span>
            <span className="tabular-nums">{character.overallXp.toLocaleString()}</span>
          </div>
        )}
        {character.lastSeenAt && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Last seen</span>
            <span className="text-gray-300">{character.lastSeenAt.replace('T', ' ').slice(0, 16)}</span>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-600">
        Shown because this account is shared. Its owner can turn that off from their profile.
      </p>
    </div>
  );
}
