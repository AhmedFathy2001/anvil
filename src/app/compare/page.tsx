import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexCharacter, type ApexCharacter } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { loadPlayerCard } from '@/lib/playerCard';
import type { PlayerCard } from '@/lib/playerCardShape';
import { comparePlayers, queryName, type Leader } from '@/lib/compare';
import { SKILL_LABELS } from '@/lib/constants';
import { bossImageForStatKey, itemIconUrl, skillIconUrl } from '@/lib/tileIcons';
import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import { accountTypeLabel } from '@/lib/accountType';
import { CompareForm, HeadlineTable, SectionTitle, Sprite, leadClass } from './CompareParts';

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

  const [cardA, cardB] = await Promise.all([loadPlayerCard(a), loadPlayerCard(b)]);
  const cmp = comparePlayers(cardA, cardB);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        <Side card={cardA} align="right" />
        <span className="pt-2 font-mono text-xs uppercase tracking-[0.2em] text-text-dim">vs</span>
        <Side card={cardB} align="left" />
      </header>

      <HeadlineTable rows={cmp.headline} />

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
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border-soft">
            {cmp.skills.map((s) => (
              <div key={s.key} className="grid grid-cols-[1.5rem_minmax(0,7rem)_3rem_1fr_3rem] items-center gap-3 px-4 py-2">
                <Sprite src={skillIconUrl(s.key)} />
                <span className="truncate text-sm">{SKILL_LABELS[s.key] ?? s.key}</span>
                <span
                  className={`text-right font-mono tabular-nums ${leadClass('a', s.leader)}`}
                  title={s.xpA != null ? `${s.xpA.toLocaleString('en-US')} xp` : undefined}
                >
                  {s.levelA ?? '—'}
                </span>
                <AheadBar a={s.levelA} b={s.levelB} leader={s.leader} />
                <span
                  className={`font-mono tabular-nums ${leadClass('b', s.leader)}`}
                  title={s.xpB != null ? `${s.xpB.toLocaleString('en-US')} xp` : undefined}
                >
                  {s.levelB ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {cmp.bosses.length > 0 && (
        <section className="mt-8">
          <SectionTitle aside={`${cmp.bosses.length} bosses either has killed`}>Bosses</SectionTitle>
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border-soft">
            {cmp.bosses.map((x) => (
              <div key={x.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_5rem] items-center gap-3 px-4 py-2">
                <Sprite src={bossImageForStatKey(x.key)} />
                <span className="truncate text-sm">{x.label}</span>
                <span className={`text-right font-mono tabular-nums ${leadClass('a', x.leader)}`}>
                  {x.kcA != null ? x.kcA.toLocaleString('en-US') : '—'}
                </span>
                <span className={`text-right font-mono tabular-nums ${leadClass('b', x.leader)}`}>
                  {x.kcB != null ? x.kcB.toLocaleString('en-US') : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle aside={cmp.logPages.length > 0 ? `${cmp.logPages.length} pages differ` : undefined}>
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
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border-soft">
            {cmp.logPages.map((p) => (
              <div key={p.name} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_5rem] items-center gap-3 px-4 py-2">
                <Sprite src={p.iconItemId != null ? itemIconUrl(p.iconItemId) : null} />
                <span className="truncate text-sm">{p.name}</span>
                <span className={`text-right font-mono tabular-nums ${leadClass('a', p.leader)}`}>
                  {p.a}/{p.total}
                </span>
                <span className={`text-right font-mono tabular-nums ${leadClass('b', p.leader)}`}>
                  {p.b}/{p.total}
                </span>
              </div>
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
        className="display block truncate text-[clamp(1.25rem,3.5vw,1.9rem)] font-semibold hover:text-gold"
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

/**
 * A centre-out bar: it grows toward whoever is ahead, by how far ahead they are out of the 98 levels
 * a skill spans. Empty for a tie or a side with no level — the colour is the verdict, so it only
 * appears when there is one.
 */
function AheadBar({ a, b, leader }: { a: number | null; b: number | null; leader: Leader | null }) {
  const gap = a != null && b != null ? Math.abs(a - b) : 0;
  const pct = leader === 'a' || leader === 'b' ? Math.max(4, Math.min(100, (gap / 98) * 100)) : 0;
  return (
    <div className="grid grid-cols-2 gap-px" aria-hidden>
      <div className="flex h-1.5 justify-end overflow-hidden rounded-l-full bg-brown-light/60">
        {leader === 'a' && <div className="h-full bg-gold" style={{ width: `${pct}%` }} />}
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-r-full bg-brown-light/60">
        {leader === 'b' && <div className="h-full bg-gold" style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}
