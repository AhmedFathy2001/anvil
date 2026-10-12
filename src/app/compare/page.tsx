import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexCharacter, type ApexCharacter } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { loadPlayerCard } from '@/lib/playerCard';
import type { PlayerCard } from '@/lib/playerCardShape';
import { comparePlayers, queryName } from '@/lib/compare';
import { compareInsights } from '@/lib/compareInsights';
import { getDailySeries } from '@/lib/memberProfile';
import { clogPageItems } from '@/lib/clogDataset';
import { db } from '@/db';
import { memberClogItems } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { SKILL_LABELS } from '@/lib/constants';
import { bossImageForStatKey, itemIconUrl, skillIconUrl } from '@/lib/tileIcons';
import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import { accountTypeLabel } from '@/lib/accountType';
import { CompareForm, HeadlineTable, SectionTitle, Sprite, leadClass, MirrorRow, Scoreboard, SIDE } from './CompareParts';

export const dynamic = 'force-dynamic';

/**
 * Two characters, side by side: /compare?a=<rsn>&b=<rsn>.
 *
 * Built to be PASTED. "Who's further, me or you?" is a conversation clanmates already have in
 * Discord, settled today by two hiscores tabs and some squinting. A link that answers it — headline
 * numbers with the leader in gold, then every skill, boss and log page where the two actually differ
 * — is the comparison and the bragging rights in one URL.
 *
 * SAME VISIBILITY AS /p/<rsn>, and for the same reason: `apexCharacter` is the one rule. A shared
 * character is anyone's to compare; an unshared one only its owner's (so you can line yourself up
 * against a friend before you publish). Everybody else gets the form back with "not on Anvil, or not
 * shared" — one sentence for both cases, because telling them apart would disclose what the owner
 * withheld.
 *
 * The numbers come off `loadPlayerCard`, the loader the plugin's card already uses, so a comparison
 * can never disagree with the profile each name links to.
 */

interface Resolved {
  /** The names as typed, for refilling the form. */
  rawA: string;
  rawB: string;
  a: ApexCharacter | null;
  b: ApexCharacter | null;
}

async function resolve(sp: Record<string, string | string[] | undefined>): Promise<Resolved> {
  const rawA = (Array.isArray(sp.a) ? sp.a[0] : sp.a)?.trim() ?? '';
  const rawB = (Array.isArray(sp.b) ? sp.b[0] : sp.b)?.trim() ?? '';
  const nameA = queryName(sp.a);
  const nameB = queryName(sp.b);
  const session = nameA || nameB ? await verifyUser() : null;
  const viewer = session?.playerId ?? null;
  const [a, b] = await Promise.all([
    nameA ? apexCharacter(nameA, viewer) : Promise.resolve(null),
    nameB ? apexCharacter(nameB, viewer) : Promise.resolve(null),
  ]);
  return { rawA, rawB, a, b };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { a, b } = await resolve(await searchParams);
  if (!a || !b) return { title: 'Compare players — Anvil' };
  const title = `${a.rsn} vs ${b.rsn} — Anvil`;
  const description = `${a.rsn} and ${b.rsn} side by side: levels, XP, efficiency, boss kills and collection log, on Anvil.`;
  return {
    title,
    description,
    // A private character is in this comparison only because its owner is the one looking.
    ...(a.privateToViewer || b.privateToViewer ? { robots: { index: false, follow: false } } : {}),
    openGraph: { title, description, type: 'website', siteName: 'Anvil' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function ComparePlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const { rawA, rawB, a, b } = await resolve(await searchParams);

  if (!a || !b) {
    // Only names that were actually typed are "missing"; an empty side is just a question not asked.
    const missing = [rawA && !a ? rawA : null, rawB && !b ? rawB : null].filter((n): n is string => !!n);
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeading />
        <CompareForm
          action="/compare"
          a={a?.rsn ?? rawA}
          b={b?.rsn ?? rawB}
          missing={missing}
          noun="player"
          placeholderA="Zezima"
          placeholderB="Lynx Titan"
          maxLength={12}
        />
        <p className="mt-4 text-xs text-text-dim">
          Any character its owner has shared can be compared. Clans can be compared too, at{' '}
          <ClanLink href="/compare/clans" className="text-gold hover:underline">
            /compare/clans
          </ClanLink>
          .
        </p>
      </div>
    );
  }

  const [cardA, cardB, seriesA, seriesB, ownedRows] = await Promise.all([
    loadPlayerCard(a),
    loadPlayerCard(b),
    getDailySeries(a.accountId, 8),
    getDailySeries(b.accountId, 8),
    // Both logs' items, for the page-by-page itemized view.
    // clan-scope: global -- two characters' own collection logs, already visibility-checked above.
    db
      .select({ accountId: memberClogItems.accountId, itemId: memberClogItems.itemId })
      .from(memberClogItems)
      .where(inArray(memberClogItems.accountId, [a.accountId, b.accountId])),
  ]);
  const cmp = comparePlayers(cardA, cardB);
  const weekOf = (series: { ehpGained: number; ehbGained: number }[]) =>
    series.length >= 7 ? series.slice(-7).reduce((t, d) => t + d.ehpGained + d.ehbGained, 0) : null;
  const insights = compareInsights(cardA, cardB, cmp, { a: weekOf(seriesA), b: weekOf(seriesB) });
  const ownedA = new Set(ownedRows.filter((r) => r.accountId === a.accountId).map((r) => r.itemId));
  const ownedB = new Set(ownedRows.filter((r) => r.accountId === b.accountId).map((r) => r.itemId));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        <Side card={cardA} align="right" />
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card-border bg-card-bg font-mono text-[11px] uppercase tracking-widest text-text-muted">
          vs
        </span>
        <Side card={cardB} align="left" />
      </header>

      <Scoreboard
        items={[
          { label: 'skills', a: cmp.skillsAhead.a, b: cmp.skillsAhead.b },
          { label: 'bosses', a: cmp.bosses.filter((x) => x.leader === 'a').length, b: cmp.bosses.filter((x) => x.leader === 'b').length },
          { label: 'log pages', a: cmp.logPages.filter((x) => x.leader === 'a').length, b: cmp.logPages.filter((x) => x.leader === 'b').length },
        ]}
      />

      <HeadlineTable rows={cmp.headline} />

      {insights.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Analysis</SectionTitle>
          {/* What the tables say read together — each point marked with whose point it is. */}
          <ul className="space-y-2 rounded-xl border border-card-border bg-card-bg px-5 py-4">
            {insights.map((i) => (
              <li key={i.key} className="flex gap-3 text-sm leading-relaxed">
                <span
                  className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${i.lead ? SIDE[i.lead].bg : 'bg-text-dim'}`}
                  aria-hidden
                />
                <span>
                  {i.parts.map((p, n) =>
                    typeof p === 'string' ? (
                      <span key={n}>{p}</span>
                    ) : (
                      <span key={n} className={`font-semibold ${SIDE[p.side].text}`}>
                        {p.side === 'a' ? cardA.rsn : cardB.rsn}
                      </span>
                    ),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cmp.skills.length > 0 && (
        <section className="mt-8">
          <SectionTitle
            aside={
              <>
                {cardA.rsn} ahead in {cmp.skillsAhead.a} · {cardB.rsn} ahead in {cmp.skillsAhead.b}
                {cmp.skillsAhead.tied > 0 ? ` · ${cmp.skillsAhead.tied} level` : ''}
              </>
            }
          >
            Skills
          </SectionTitle>
          {/* The game's own skill tab, both levels on each tile and the tile tinted toward whoever
              leads it — the grid every player's eye already knows, not a 24-row table. */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SKILL_TAB_ORDER.map((key) => cmp.skills.find((x) => x.key === key))
              .filter((x): x is NonNullable<typeof x> => !!x)
              .map((x) => (
                <div
                  key={x.key}
                  title={`${SKILL_LABELS[x.key] ?? x.key} — ${x.xpA != null ? x.xpA.toLocaleString('en-US') : '?'} vs ${
                    x.xpB != null ? x.xpB.toLocaleString('en-US') : '?'
                  } xp`}
                  className={`flex items-center gap-2.5 rounded-lg border border-card-border px-3 py-2 ${
                    x.leader === 'a' ? SIDE.a.soft : x.leader === 'b' ? SIDE.b.soft : 'bg-card-bg'
                  }`}
                >
                  <Sprite src={skillIconUrl(x.key)} />
                  <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{SKILL_LABELS[x.key] ?? x.key}</span>
                  <span className={`font-mono text-sm tabular-nums ${leadClass('a', x.leader)}`}>{x.levelA ?? '—'}</span>
                  <span className="text-[10px] text-text-dim">·</span>
                  <span className={`font-mono text-sm tabular-nums ${leadClass('b', x.leader)}`}>{x.levelB ?? '—'}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {cmp.bosses.length > 0 && (
        <section className="mt-8">
          <SectionTitle aside={`${cmp.bosses.length} bosses either has killed`}>Bosses</SectionTitle>
          <div className="rounded-xl border border-card-border bg-card-bg py-2">
            {cmp.bosses.map((x) => (
              <MirrorRow
                key={x.key}
                icon={<Sprite src={bossImageForStatKey(x.key)} />}
                label={x.label}
                a={x.kcA}
                b={x.kcB}
                leader={x.leader}
                scale={bossScale}
                format={(n) => (n != null ? n.toLocaleString('en-US') : '—')}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle
          aside={
            cmp.logPages.length > 0 ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{cmp.logPages.length} pages differ — open one to see it item by item</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-gold" />only {cardA.rsn}</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#8fb4d4]" />only {cardB.rsn}</span>
              </span>
            ) : undefined
          }
        >
          Collection log
        </SectionTitle>
        {!cardA.clog || !cardB.clog ? (
          <p className="rounded-xl border border-dashed border-card-border px-5 py-4 text-sm text-text-muted">
            {[!cardA.clog ? cardA.rsn : null, !cardB.clog ? cardB.rsn : null].filter(Boolean).join(' and ')}{' '}
            {!cardA.clog && !cardB.clog ? "haven't" : "hasn't"} synced a collection log yet, so there is nothing to
            line up page by page.
          </p>
        ) : cmp.logPages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-card-border px-5 py-4 text-sm text-text-muted">
            Every page matches, slot for slot.
          </p>
        ) : (
          <div className="rounded-xl border border-card-border bg-card-bg py-2">
            {cmp.logPages.map((p) => (
              // Each page opens to its slots: both have it, only one does, or neither — item by item.
              <details key={p.name} className="group">
                <summary className="cursor-pointer list-none hover:bg-gold/5 [&::-webkit-details-marker]:hidden">
                  <MirrorRow
                    icon={<Sprite src={p.iconItemId != null ? itemIconUrl(p.iconItemId) : null} />}
                    label={<>{p.name} <span className="text-text-dim group-open:rotate-90 inline-block transition-transform">›</span></>}
                    a={p.a}
                    b={p.b}
                    leader={p.leader}
                    scale={(n) => (p.total > 0 ? (n / p.total) * 100 : 0)}
                    format={(n) => `${n ?? 0}/${p.total}`}
                  />
                </summary>
                <div className="flex flex-wrap justify-center gap-1.5 px-4 pb-4 pt-2">
                  {clogPageItems(p.name).map((item) => {
                    const hasA = ownedA.has(item.id);
                    const hasB = ownedB.has(item.id);
                    const who = hasA && hasB ? 'both' : hasA ? cardA.rsn : hasB ? cardB.rsn : 'neither';
                    return (
                      <span
                        key={item.id}
                        title={`${item.name} — ${who === 'both' ? 'both have it' : who === 'neither' ? 'neither has it' : `only ${who}`}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-md border-2 ${
                          hasA && hasB
                            ? 'border-card-border bg-brown-light/40'
                            : hasA
                              ? 'border-gold bg-gold/10'
                              : hasB
                                ? 'border-[#8fb4d4] bg-[#8fb4d4]/10'
                                : 'border-transparent bg-brown-dark/40 opacity-30'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- remote game sprites, tiny and cached */}
                        <img src={itemIconUrl(item.id)} alt="" loading="lazy" className="max-h-8 max-w-8 object-contain [image-rendering:pixelated]" />
                      </span>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-text-dim">
        Compare someone else:{' '}
        <ClanLink href={`/compare?a=${encodeURIComponent(cardA.rsn)}`} className="text-gold hover:underline">
          {cardA.rsn} vs …
        </ClanLink>
      </p>
    </div>
  );
}

/** The in-game skill tab, read left to right. */
const SKILL_TAB_ORDER = [
  'attack', 'hitpoints', 'mining', 'strength', 'agility', 'smithing', 'defence', 'herblore', 'fishing',
  'ranged', 'thieving', 'cooking', 'prayer', 'crafting', 'firemaking', 'magic', 'fletching', 'woodcutting',
  'runecraft', 'slayer', 'farming', 'construction', 'hunter', 'sailing',
];

/** Kill counts on a log scale against 2,000 — a 1,369 next to a 6 still both read. */
function bossScale(n: number): number {
  return Math.min(100, (Math.log10(n + 1) / Math.log10(2001)) * 100);
}

function PageHeading() {
  return (
    <div className="mb-5">
      <h1 className="display text-2xl font-semibold">Compare players</h1>
      <p className="mt-1 text-sm text-text-muted">Two characters side by side — levels, bosses and collection log.</p>
    </div>
  );
}

function Side({ card, align }: { card: PlayerCard; align: 'left' | 'right' }) {
  const right = align === 'right';
  return (
    <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
      <ClanLink
        href={`/p/${encodeURIComponent(card.rsn)}`}
        className={`display block truncate text-[clamp(1.25rem,3.5vw,1.9rem)] font-semibold hover:underline ${
          right ? SIDE.a.text : SIDE.b.text
        }`}
      >
        {card.rsn}
      </ClanLink>
      <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-muted ${right ? 'justify-end' : ''}`}>
        {card.clan ? (
          <ClanLink href={`/c/${card.clan.slug}`} className="flex items-center gap-1.5 hover:text-gold">
            <ClanCrest name={card.clan.name} size={16} />
            {card.clan.name}
          </ClanLink>
        ) : (
          <span className="text-text-dim">No clan</span>
        )}
        {accountTypeLabel(card.accountType) ? <span>{accountTypeLabel(card.accountType)}</span> : null}
      </div>
    </div>
  );
}
