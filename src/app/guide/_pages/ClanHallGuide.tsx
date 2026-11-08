import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// The public browse pages: Clan Hall (app/clans, lib/clanListing), /compare/clans, /leaderboard, /events
// (lib/eventsDirectory) and in-game clan pages for clans not on Anvil (app/clans/g/[key]).
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES).
export const HALL_SECTIONS = ['hall', 'compare', 'board', 'events', 'ghost'] as const;

export async function clanHallGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'clan-hall', t.clanHall.metaTitle, t.clanHall.metaDescription);
}

export default async function ClanHallGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.clanHall;
  const { locale, languages, notice } = localeChrome(lang, 'clan-hall', t.common);
  const v = { clanGuide: guideHref(locale.code, 'clan'), boostsGuide: guideHref(locale.code, 'clan-boosts') };

  const SECTIONS = HALL_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

  return (
    <GuideShell
      eyebrow={g.eyebrow}
      title={g.title}
      sections={SECTIONS}
      minutes={3}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(g.dek, v)}
      facts={g.facts}
      footnote={rt(g.footnote, v)}
    >
      <Section id="hall" n={1} title={g.hall.title} labels={t.common}>
        <SectionBlocks s={g.hall} v={v} />
      </Section>

      <Section id="compare" n={2} title={g.compare.title} labels={t.common}>
        <SectionBlocks s={g.compare} v={v} />
      </Section>

      <Section id="board" n={3} title={g.board.title} labels={t.common}>
        <SectionBlocks s={g.board} v={v} />
      </Section>

      <Section id="events" n={4} title={g.events.title} labels={t.common}>
        <SectionBlocks s={g.events} v={v} />
      </Section>

      <Section id="ghost" n={5} title={g.ghost.title} labels={t.common}>
        <SectionBlocks s={g.ghost} v={v} />
      </Section>
    </GuideShell>
  );
}
