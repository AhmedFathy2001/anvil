import type { Metadata } from 'next';
import ClanLink from '@/components/ClanLink';
import { LanguageBar } from '../_components/LanguageBar';
import { getDict, findLocale, guideHref, LOCALES, type GuidePage } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { SEARCH_TERMS } from '../_i18n/searchTerms';
import GuideSearch, { type GuideCard } from '../_components/GuideSearch';
import { rt } from '../_i18n/rich';
import GuideTabs from '../_components/GuideTabs';
import { libraryCards, groupLibraryCards, type GuideTab } from '../_i18n/guideTabs';
import { currentClan } from '@/lib/clanContext';
import { listLibrary } from '@/lib/guides';
import { categoryOf, readingMinutes } from '@/lib/guideCategories';
import { listCategories } from '@/lib/guideCategoryStore';
import { absoluteUrl } from '@/lib/seo';

// Eight guides is too many for one flat grid — grouped by who is reading, so a captain looking for
// their own page doesn't have to read the treasurer's blurb first. The grouping lives here rather
// than in the dictionary: which audience a guide belongs to isn't a translation decision.
const GROUPS: { key: 'playing' | 'running' | 'clan' | 'streamers'; pages: Exclude<GuidePage, ''>[] }[] = [
  { key: 'playing', pages: ['plugin', 'tiles', 'captain', 'commands'] },
  { key: 'running', pages: ['admin', 'formats', 'board', 'clan-vs-clan'] },
  // Starting a clan comes first here on purpose: it is the only guide whose reader does not have one
  // yet, and the rest of this group is written for someone already running it.
  { key: 'clan', pages: ['switching', 'clan', 'discord', 'people', 'staff-roles', 'moderator', 'fees', 'coffer'] },
  // Streamers: the host's guide first (it is the one the admin sidebar sends a creator to), then the
  // page their viewers need, then the clan that streams.
  { key: 'streamers', pages: ['creators', 'joining-a-streamer-event', 'streaming-for-clans'] },
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
  commands: 'commands',
  switching: 'switching',
  tiles: 'tiles',
  creators: 'creators',
  'joining-a-streamer-event': 'joiningStream',
  'streaming-for-clans': 'streamingClans',
  people: 'people',
  'staff-roles': 'staffRoles',
} as const;

export async function guideIndexMetadata(lang: string, tab: GuideTab = 'anvil'): Promise<Metadata> {
  const t = await getDict(lang);
  // The canonical stays the bare index for both tabs: they are one document (both lists are in the
  // HTML), and a second canonical would split it. The title and description follow the tab, so a
  // shared `?tab=ingame` link previews as what it opens on.
  return tab === 'ingame'
    ? guideMetadata(lang, '', t.index.ingame.metaTitle, t.index.ingame.metaDescription)
    : guideMetadata(lang, '', t.index.metaTitle, t.index.metaDescription);
}

export default async function GuideIndex({ lang, tab = 'anvil' }: { lang: string; tab?: GuideTab }) {
  const t = await getDict(lang);
  const locale = findLocale(lang) ?? LOCALES[0];
  const clan = await currentClan();
  // The Anvil library only — never a clan's own guides or its copies, which are that clan's to show
  // (on its /guides). Never let the guides module take the setup guides down with it either: they
  // are how people get unstuck.
  const [library, cats] = await Promise.all([
    listLibrary().catch(() => []),
    listCategories(null).catch(() => []),
  ]);
  // Inside a clan, `/guides/<slug>` is the CLAN's reading of that slug (its copy, or nothing if it
  // hides the library), so library links go to the apex, where the slug is always the original.
  const libraryHref = (path: string) => (clan ? absoluteUrl(path) : path);
  const ingameCards = libraryCards(
    library.map((g) => ({ ...g, minutes: readingMinutes(g.body) })),
    { category: (key) => categoryOf(key, cats), href: (slug) => libraryHref(`/guides/${slug}`), readTime: t.index.ingame.readTime },
  );
  const ingameGroups = groupLibraryCards(ingameCards, cats.map((c) => c.key));

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

  const anvilPanel = (
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
  );

  // The in-game guides module's library: OSRS content (raids, bosses, skilling, money makers), the
  // same guides the plugin shows in-game and the bot posts to Discord. Content, not dictionary — the
  // guides are not translated, and the note says so rather than letting the picker imply otherwise.
  const ingamePanel = (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-text-muted">{t.index.ingame.dek}</p>
          <p className="mt-1 text-[12px] text-text-muted/80">{t.index.ingame.language}</p>
        </div>
        <ClanLink href={libraryHref('/guides')} className="shrink-0 text-sm text-gold hover:underline">
          {t.index.ingame.browse} →
        </ClanLink>
      </div>
      {ingameCards.length === 0 ? (
        <p className="rounded-xl border border-card-border bg-card-bg px-5 py-8 text-center text-sm text-text-muted">
          {t.index.ingame.empty}
        </p>
      ) : (
        <GuideSearch
          cards={ingameCards}
          labels={{ ...t.index.search, placeholder: t.index.ingame.placeholder }}
        >
          <div className="space-y-8">
            {ingameGroups.map((group) => {
              const cat = categoryOf(group.category, cats);
              return (
                <section key={group.category}>
                  <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
                    <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
                    {cat.label}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.cards.map((card) => (
                      <ClanLink
                        key={card.page}
                        href={card.href}
                        className="group rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40 hover:bg-brown-light/20"
                      >
                        <div className="mb-2 text-[11px] uppercase tracking-widest text-gold/80">{card.eyebrow}</div>
                        <div className="mb-1 text-[15px] font-bold transition-colors group-hover:text-gold-light">
                          {card.title}
                        </div>
                        {card.blurb && <p className="mb-3 line-clamp-2 text-[13px] text-text-muted">{card.blurb}</p>}
                        <div className="text-[11.5px] text-text-muted/80">{card.minutes}</div>
                      </ClanLink>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </GuideSearch>
      )}
    </>
  );

  return (
    <div className="max-w-3xl" lang={locale.code} dir={locale.dir}>
      <LanguageBar current={locale.code} page="" label={t.common.language} />

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gold sm:text-3xl">{t.index.title}</h1>
        <p className="mt-1 text-sm text-text-muted">{rt(t.index.dek)}</p>
      </header>

      <GuideTabs
        initial={tab}
        labels={{ anvil: t.index.anvilTab, ingame: t.index.ingame.title }}
        anvil={anvilPanel}
        ingame={ingamePanel}
      />
    </div>
  );
}
