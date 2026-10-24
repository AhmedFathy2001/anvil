import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { isApexHost } from '@/lib/clanContext';
import { ghostClanPage } from '@/lib/gameClans';
import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';

export const dynamic = 'force-dynamic';

/**
 * A ghost clan: an in-game clan that is not on Anvil, as the Anvil players in it describe it
 * (lib/gameClans). Reached from a character's clan line and nowhere else — unlisted, out of the
 * sitemap and noindex, because nobody in that clan asked for a page.
 *
 * It lists only Anvil users who share their character and have not hidden their clan, never the
 * clan's roster. When the clan IS on Anvil (verified in-game name) its own page answers instead.
 */
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const page = await ghostClanPage(decodeURIComponent((await params).key)).catch(() => null);
  const name = page?.kind === 'ghost' ? page.name : 'Clan';
  return { title: `${name} — in-game clan`, robots: { index: false, follow: false } };
}

export default async function GhostClanPage({ params }: { params: Promise<{ key: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const page = await ghostClanPage(decodeURIComponent((await params).key));
  if (!page) notFound();
  if (page.kind === 'anvil') redirect(`/c/${page.slug}`);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-7 flex items-center gap-4">
        <ClanCrest name={page.name} size={52} />
        <div>
          <h1 className="display display-lg text-[clamp(1.6rem,4vw,2.1rem)] font-semibold">{page.name}</h1>
          <p className="mt-1 text-[13.5px] text-text-muted">
            In-game clan · {page.members.length} Anvil {page.members.length === 1 ? 'player' : 'players'}
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-card-border bg-card-bg">
        <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
          <span className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="text-sm font-semibold">Anvil players in this clan</h2>
        </div>
        <ul className="divide-y divide-card-border">
          {page.members.map((m) => (
            <li key={m.rsn} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
              <ClanLink href={`/p/${encodeURIComponent(m.rsn)}`} className="font-medium transition-colors hover:text-gold">
                {m.rsn}
              </ClanLink>
              <span className="flex items-center gap-3 text-[13px] text-text-muted">
                {m.title && <span>{m.title}</span>}
                {m.joinedOn && (
                  <span className="text-text-dim">
                    since {new Date(`${m.joinedOn}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-5 text-xs leading-relaxed text-text-dim">
        This clan isn’t on Anvil. The players above run the Anvil plugin and share their profiles; their
        clan and rank come from their own game client. It is not the clan’s roster.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-5 py-4">
        <span className="text-[13.5px] text-text-muted">
          Run {page.name}? Bingos, weekly competitions and a roster that keeps itself up to date.
        </span>
        <ClanLink
          href="/clans/new"
          className="rounded-lg bg-gold px-3 py-1.5 text-[12.5px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Bring your clan to Anvil
        </ClanLink>
      </div>
    </div>
  );
}
