import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexPerson } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * One PERSON — the human, who plays characters.
 *
 * Keyed by id rather than a name because a person has no unique one: display names collide, and an
 * RSN names a character, which is what /p/ is for. "Ahmed" is a user; "Drenvox mdps" is one of the
 * accounts they play.
 *
 * A WAY IN, not an index. This was a column of names with a clan beside each, which said nothing a
 * search result would not. Each character now carries its own numbers — the same figures /p/<rsn>
 * opens with — because the only reason to look someone up is to see what they have been doing.
 *
 * Lists only their SHARED characters, because the apex is nobody's clan and the visibility rule
 * therefore reduces to sharing alone. Somebody who has published nothing is a 404 rather than a
 * page with their name and an empty list — the empty list would itself say something about them.
 */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const person = await apexPerson(Number((await params).id));
  return person ? { title: `${person.label} — Anvil` } : { title: 'Not found — Anvil' };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const person = await apexPerson(id);
  if (!person) notFound();

  const week = person.characters.reduce((n, c) => n + c.xpThisWeek, 0);
  const tracked = person.characters.filter((c) => c.overallXp != null).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="relative mb-8 overflow-hidden">
        <AnvilMark
          size={180}
          className="pointer-events-none absolute -top-8 right-0 hidden text-gold/[0.04] sm:block"
        />
        {/* Their primary shared RSN. The Discord display name used to be the page's h1 and its title. */}
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">
          {person.label}
        </h1>
        <p className="relative mt-2 text-[14.5px] text-text-muted">
          {person.characters.length} shared {person.characters.length === 1 ? 'character' : 'characters'}
          {week > 0 && <> · {compact(week)} XP this week</>}
        </p>
      </header>

      <ul className="flex flex-col gap-2.5">
        {person.characters.map((c) => (
          <li key={c.rsn}>
            <ClanLink
              href={`/p/${encodeURIComponent(c.rsn)}`}
              className="flex items-center gap-3.5 rounded-xl border border-card-border bg-card-bg px-4 py-3.5 transition-colors hover:border-gold/40 hover:bg-card-bg-hover sm:px-5"
            >
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md bg-brown-light font-mono text-[12px] text-text-muted">
                {c.rsn.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{c.rsn}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-text-dim">
                  {c.clan ?? 'No clan'}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[13.5px] tabular-nums">
                  {c.overallXp != null ? compact(c.overallXp) : '—'}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">
                  total xp
                </span>
              </span>
              <span className="hidden shrink-0 text-right sm:block">
                <span
                  className={`block font-mono text-[13.5px] tabular-nums ${
                    c.xpThisWeek > 0 ? 'text-accent-green-light' : 'text-text-dim'
                  }`}
                >
                  {c.xpThisWeek > 0 ? `+${compact(c.xpThisWeek)}` : '—'}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">
                  this week
                </span>
              </span>
            </ClanLink>
          </li>
        ))}
      </ul>

      {tracked === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-card-border px-5 py-6 text-center text-[13.5px] text-text-muted">
          None of these characters has been tracked yet. Numbers appear once the hiscores sweep has
          seen them, or as soon as the RuneLite plugin pushes.
        </p>
      )}

      <p className="mt-8 text-xs text-text-dim">
        Only shared characters appear here. Anything else this person plays is between them and the
        clans they&rsquo;re in.
      </p>
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
