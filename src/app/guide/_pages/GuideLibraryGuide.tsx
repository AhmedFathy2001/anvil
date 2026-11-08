import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// The game-guide library (app/guides, lib/guideProposals, lib/guides) and a clan's own copies (app/admin/guides).
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES).
export const LIBRARY_SECTIONS = ['read', 'propose', 'clan'] as const;

export async function guideLibraryGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'in-game-guides', t.guideLibrary.metaTitle, t.guideLibrary.metaDescription);
}

export default async function GuideLibraryGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.guideLibrary;
  const { locale, languages, notice } = localeChrome(lang, 'in-game-guides', t.common);
  const v = { commandsGuide: guideHref(locale.code, 'commands') };

  const SECTIONS = LIBRARY_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

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
      <Section id="read" n={1} title={g.read.title} labels={t.common}>
        <SectionBlocks s={g.read} v={v} />
      </Section>

      <Section id="propose" n={2} title={g.propose.title} labels={t.common}>
        <SectionBlocks s={g.propose} v={v} />
      </Section>

      <Section id="clan" n={3} title={g.clan.title} labels={t.common}>
        <SectionBlocks s={g.clan} v={v} />
      </Section>
    </GuideShell>
  );
}
