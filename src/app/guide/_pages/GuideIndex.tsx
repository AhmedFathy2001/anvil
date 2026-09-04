import type { Metadata } from 'next';
import ClanLink from '@/components/ClanLink';
import { LanguageBar } from '../_components/LanguageBar';
import { getDict, findLocale, guideHref, LOCALES, type GuidePage } from '../_i18n';
import { SEARCH_TERMS } from '../_i18n/searchTerms';
import GuideSearch, { type GuideCard } from '../_components/GuideSearch';
import { rt } from '../_i18n/rich';

// Eight guides is too many for one flat grid — grouped by who is reading, so a captain looking for
// their own page doesn't have to read the treasurer's blurb first. The grouping lives here rather
// than in the dictionary: which audience a guide belongs to isn't a translation decision.
const GROUPS: { key: 'playing' | 'running' | 'clan'; pages: Exclude<GuidePage, ''>[] }[] = [
  { key: 'playing', pages: ['plugin', 'captain'] },
  { key: 'running', pages: ['admin', 'formats', 'board', 'clan-vs-clan'] },
  // Starting a clan comes first here on purpose: it is the only guide whose reader does not have one
  // yet, and the rest of this group is written for someone already running it.
  { key: 'clan', pages: ['clan', 'discord', 'moderator', 'fees'] },
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
} as const;

export async function guideIndexMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.index.metaTitle, description: t.index.metaDescription };
}

export default async function GuideIndex({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const locale = findLocale(lang) ?? LOCALES[0];

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

      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        <h1 className="text-3xl font-bold">{t.index.title}</h1>
      </div>
      <p className="text-text-muted mb-8">{rt(t.index.dek)}</p>

      <GuideSearch cards={cards} labels={t.index.search}>
      <div className="space-y-10">
        {GROUPS.map((group) => (
          <section key={group.key}>
            <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
              {t.index.groups[group.key]}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {group.pages.map((page) => {
                const card = t.index.cards[CARD_KEY[page]];
                return (
                  <ClanLink
                    key={page}
                    href={guideHref(locale.code, page)}
                    className="group border border-card-border rounded-xl bg-card-bg p-5 hover:border-gold/40 transition-colors"
                  >
                    <div className="text-[11px] uppercase tracking-widest text-gold mb-2">{card.eyebrow}</div>
                    <div className="text-lg font-semibold mb-1 group-hover:text-gold-light transition-colors">
                      {card.title}
                    </div>
                    <p className="text-sm text-text-muted mb-3">{card.blurb}</p>
                    <div className="text-xs text-text-muted">{card.minutes}</div>
                  </ClanLink>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      </GuideSearch>
    </div>
  );
}
