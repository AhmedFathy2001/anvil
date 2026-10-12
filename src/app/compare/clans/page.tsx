import { headers } from 'next/headers';
import { ChangeSide, SwapSides } from '../CompareSwitch';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { apexClan } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import { loadClanCard, type ClanCard } from '@/lib/clanCard';
import { compactNumber, compareClans, queryName } from '@/lib/compare';
import { itemIconUrl } from '@/lib/tileIcons';
import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import { CompareForm, HeadlineTable, SectionTitle, Sprite } from '../CompareParts';

export const dynamic = 'force-dynamic';

/**
 * Two clans, side by side: /compare/clans?a=<slug>&b=<slug>.
 *
 * The clan-vs-clan question — "are they actually bigger than us, or just louder?" — answered with
 * the numbers the clan card already computes for the plugin's Clan tab: size, how many played this
 * week, total efficient hours, the average log, and then the people behind them.
 *
 * VISIBILITY IS `apexClan`, the same test the clan's public face and the card route use: a clan that
 * is not public, or opted out of the directory, is not on this page — and the form says "not on
 * Anvil, or not listed publicly" without saying which. Unlike the card route there is no seat-based
 * widening here: a comparison is made to be shared, and a link that renders for its author but not
 * for the channel it was pasted into would be worse than no link.
 */

interface Resolved {
  rawA: string;
  rawB: string;
  a: ClanRow | null;
  b: ClanRow | null;
}

interface ClanRow {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
}

async function resolveClan(slug: string | null): Promise<ClanRow | null> {
  if (!slug) return null;
  const listed = await apexClan(slug.toLowerCase());
  if (!listed) return null;
  // clan-scope: global -- reading the logo of a clan apexClan has just resolved by slug; there is no
  // other clan to scope it to.
  const row = await db.query.clans.findFirst({ where: eq(clans.id, listed.id), columns: { logoUrl: true } });
  return { id: listed.id, slug: listed.slug, name: listed.name, logoUrl: row?.logoUrl ?? null };
}

async function resolve(sp: Record<string, string | string[] | undefined>): Promise<Resolved> {
  const rawA = (Array.isArray(sp.a) ? sp.a[0] : sp.a)?.trim() ?? '';
  const rawB = (Array.isArray(sp.b) ? sp.b[0] : sp.b)?.trim() ?? '';
  const [a, b] = await Promise.all([resolveClan(queryName(sp.a, 64)), resolveClan(queryName(sp.b, 64))]);
  return { rawA, rawB, a, b };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { a, b } = await resolve(await searchParams);
  if (!a || !b) return { title: 'Compare clans — Anvil' };
  const title = `${a.name} vs ${b.name} — Anvil`;
  const description = `${a.name} and ${b.name} side by side: members, activity, efficient hours and collection logs, on Anvil.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'Anvil' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function CompareClansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const { rawA, rawB, a, b } = await resolve(await searchParams);

  if (!a || !b) {
    const missing = [rawA && !a ? rawA : null, rawB && !b ? rawB : null].filter((n): n is string => !!n);
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5">
          <h1 className="display text-2xl font-semibold">Compare clans</h1>
          <p className="mt-1 text-sm text-text-muted">
            Two clans side by side, by their Anvil address — the <span className="font-mono">slug</span> in{' '}
            <span className="font-mono">/c/slug</span>.
          </p>
        </div>
        <CompareForm
          action="/compare/clans"
          a={a?.slug ?? rawA}
          b={b?.slug ?? rawB}
          missing={missing}
          noun="clan"
          placeholderA="theafkspot"
          placeholderB="another-clan"
          maxLength={64}
        />
        <p className="mt-4 text-xs text-text-dim">
          Any clan in the{' '}
          <ClanLink href="/clans" className="text-gold hover:underline">
            directory
          </ClanLink>{' '}
          can be compared. Comparing players instead?{' '}
          <ClanLink href="/compare" className="text-gold hover:underline">
            /compare
          </ClanLink>
        </p>
      </div>
    );
  }

  const [cardA, cardB] = await Promise.all([loadClanCard(a), loadClanCard(b)]);
  const cmp = compareClans(cardA, cardB);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="min-w-0 text-right">
          <ClanSide card={cardA} align="right" />
          <ChangeSide basePath="/compare/clans" side="a" current={cardA.slug} other={cardB.slug} noun="clan" maxLength={64} align="right" />
        </div>
        <SwapSides
          basePath="/compare/clans"
          a={cardA.slug}
          b={cardB.slug}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-card-bg font-mono text-[11px] uppercase tracking-widest text-text-muted"
        />
        <div className="min-w-0">
          <ClanSide card={cardB} align="left" />
          <ChangeSide basePath="/compare/clans" side="b" current={cardB.slug} other={cardA.slug} noun="clan" maxLength={64} align="left" />
        </div>
      </header>

      <HeadlineTable rows={cmp.headline} />

      <section className="mt-8">
        <SectionTitle aside="By total XP">Top players</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {[cardA, cardB].map((c) => (
            <PeopleCard
              key={c.slug}
              title={c.name}
              rows={c.topPlayers.map((p) => ({ rsn: p.rsn, value: `${compactNumber(p.overallXp)} xp` }))}
              empty="No tracked members yet."
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle aside="Efficient hours gained, last 7 days">This week&apos;s top gainers</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {[cardA, cardB].map((c) => (
            <PeopleCard
              key={c.slug}
              title={c.name}
              rows={c.topWeek.map((p) => ({ rsn: p.rsn, value: `${p.hours.toFixed(1)} h` }))}
              empty="Nobody has gained anything this week."
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle aside="Pets and notable drops">Highlights</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {[cardA, cardB].map((c) => (
            <div key={c.slug} className="border border-card-border rounded-xl bg-card-bg p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-dim">{c.name}</div>
              {c.highlights.length === 0 ? (
                <p className="text-sm text-text-muted">Nothing notable lately.</p>
              ) : (
                <ul className="space-y-1.5">
                  {c.highlights.map((h, i) => (
                    <li key={`${h.rsn}-${h.at}-${i}`} className="flex items-center gap-2.5 text-sm">
                      <Sprite src={h.itemId != null ? itemIconUrl(h.itemId) : null} />
                      <span className="min-w-0 flex-1 truncate">
                        {h.rsn} <span className="text-text-muted">— {h.label}</span>
                      </span>
                      {h.kind === 'pet' && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">Pet</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClanSide({ card, align }: { card: ClanCard; align: 'left' | 'right' }) {
  const right = align === 'right';
  return (
    <ClanLink
      href={`/c/${card.slug}`}
      className={`flex min-w-0 items-center gap-3 hover:text-gold ${right ? 'flex-row-reverse text-right' : ''}`}
    >
      <ClanCrest variant="letter" slug={card.slug} name={card.name} logoUrl={card.logoUrl} size={40} />
      <span className="display truncate text-[clamp(1.2rem,3.2vw,1.8rem)] font-semibold">{card.name}</span>
    </ClanLink>
  );
}

/**
 * Names are plain text, not links to /p/<rsn>: most members never shared their character, and a list
 * where most links 404 reads as broken. The clan card shows the names already; that is all this does.
 */
function PeopleCard({ title, rows, empty }: { title: string; rows: { rsn: string; value: string }[]; empty: string }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-dim">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.rsn} className="flex items-center gap-2.5 text-sm">
              <span className={`w-4 font-mono text-xs ${i === 0 ? 'text-gold' : 'text-text-dim'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.rsn}
              </span>
              <span className="font-mono tabular-nums text-text-muted">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
