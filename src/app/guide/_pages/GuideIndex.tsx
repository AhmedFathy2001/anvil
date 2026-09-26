import type { Metadata } from 'next';
import ClanLink from '@/components/ClanLink';
import { LanguageBar } from '../_components/LanguageBar';
import { getDict, findLocale, guideHref, LOCALES, type GuidePage } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { SEARCH_TERMS } from '../_i18n/searchTerms';
import GuideSearch, { type GuideCard } from '../_components/GuideSearch';
import { rt } from '../_i18n/rich';
import { currentClan } from '@/lib/clanContext';
import { publicGuides } from '@/lib/guides';
import { categoryOf } from '@/lib/guideCategories';

// Eight guides is too many for one flat grid — grouped by who is reading, so a captain looking for
// their own page doesn't have to read the treasurer's blurb first. The grouping lives here rather
// than in the dictionary: which audience a guide belongs to isn't a translation decision.
const GROUPS: { key: 'playing' | 'running' | 'clan'; pages: Exclude<GuidePage, ''>[] }[] = [
  { key: 'playing', pages: ['plugin', 'captain'] },
  { key: 'running', pages: ['admin', 'formats', 'board', 'clan-vs-clan'] },
  // Starting a clan comes first here on purpose: it is the only guide whose reader does not have one
  // yet, and the rest of this group is written for someone already running it.
  { key: 'clan', pages: ['clan', 'discord', 'moderator', 'fees', 'coffer'] },
];

/** Route slug → dictionary card key (they differ only where the slug is hyphenated). */
const CARD_KEY = {
  clan: 'clan',
  discord: 'discord',
  plugin: 'plugin',
  captain: 'captain',
  admin: 'admin',
  formats: 'formats',
  board: 'board',
  'clan-vs-clan': 'clanVsClan',
  moderator: 'moderator',
  fees: 'fees',
  coffer: 'coffer',
} as const;

export async function guideIndexMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, '', t.index.metaTitle, t.index.metaDescription);
}

export default async function GuideIndex({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const locale = findLocale(lang) ?? LOCALES[0];
  const clan = await currentClan();
  // Never let the guides module take the setup guides down with it: they are how people get unstuck.
  const ingame = await publicGuides(clan?.id ?? null).catch(() => []);

  // The same cards the grid renders, flattened for the search box. Built from GROUPS rather than a
  // second list, so a guide can never be searchable but unlisted (or listed but unfindable).
  const cards: GuideCard[] = GROUPS.flatMap((group) =>
    group.pages.map((page) => {
      const card = t.index.cards[CARD_KEY[page]];
      return {
        page,
        href: guideHref(locale.code, page),
        eyebrow: card.eyebrow,
        title: card.title,
        blurb: card.blurb,
        minutes: card.minutes,
        terms: SEARCH_TERMS[page],
      };
    }),
  );

  return (
    <div className="max-w-3xl" lang={locale.code} dir={locale.dir}>
      <LanguageBar current={locale.code} page="" label={t.common.language} />

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gold sm:text-3xl">{t.index.title}</h1>
        <p className="mt-1 text-sm text-text-muted">{rt(t.index.dek)}</p>
      </header>

      <GuideSearch cards={cards} labels={t.index.search}>
      <div className="space-y-8">
        {GROUPS.map((group) => (
          <section key={group.key}>
            <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
              <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
              {t.index.groups[group.key]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.pages.map((page) => {
                const card = t.index.cards[CARD_KEY[page]];
                return (
                  <ClanLink
                    key={page}
                    href={guideHref(locale.code, page)}
                    className="group rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40 hover:bg-brown-light/20"
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-widest text-gold/80">{card.eyebrow}</div>
                    <div className="mb-1 text-[15px] font-bold transition-colors group-hover:text-gold-light">
                      {card.title}
                    </div>
                    <p className="mb-3 text-[13px] text-text-muted">{card.blurb}</p>
                    <div className="text-[11.5px] text-text-muted/80">{card.minutes}</div>
                  </ClanLink>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      </GuideSearch>

      {/* The in-game guides module (/guides): what the clan and the Anvil library have written about
          the game itself, as opposed to the pages above about using Anvil. Content, not dictionary —
          the guides are written in whatever language their author wrote them in. */}
      {ingame.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-[17px] font-bold">
                <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
                {t.index.ingame.title}
              </h2>
              <p className="mt-1 text-[13px] text-text-muted">{t.index.ingame.dek}</p>
            </div>
            <ClanLink href="/guides" className="text-sm text-gold hover:underline">
              {t.index.ingame.browse} →
            </ClanLink>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ingame.slice(0, 6).map(({ guide: g, origin }) => (
              <ClanLink
                key={g.id}
                href={`/guides/${g.slug}`}
                className="group rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40 hover:bg-brown-light/20"
              >
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest text-gold/80">
                  <span>
                    {categoryOf(g.category).icon} {categoryOf(g.category).label}
                  </span>
                  {origin === 'library' && clan && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 normal-case tracking-normal text-text-muted">
                      {t.index.ingame.library}
                    </span>
                  )}
                </div>
                <div className="mb-1 text-[15px] font-bold transition-colors group-hover:text-gold-light">{g.title}</div>
                {g.summary && <p className="line-clamp-2 text-[13px] text-text-muted">{g.summary}</p>}
              </ClanLink>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
