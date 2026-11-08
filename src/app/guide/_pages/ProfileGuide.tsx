import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// Your own pages (app/profile, app/p/[rsn], app/u/[id], members/[rsn]), monthly Wrapped (lib/monthlyWrappedRules),
// event Wrapped (app/events/[eventId]/wrapped, lib/eventWrapped) and /compare.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES).
export const PROFILE_SECTIONS = ['pages', 'sharing', 'wrapped', 'events', 'compare'] as const;

export async function profileGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'profile', t.profile.metaTitle, t.profile.metaDescription);
}

export default async function ProfileGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.profile;
  const { locale, languages, notice } = localeChrome(lang, 'profile', t.common);
  const v = { settingsGuide: guideHref(locale.code, 'settings') };

  const SECTIONS = PROFILE_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

  return (
    <GuideShell
      eyebrow={g.eyebrow}
      title={g.title}
      sections={SECTIONS}
      minutes={4}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(g.dek, v)}
      facts={g.facts}
      footnote={rt(g.footnote, v)}
    >
      <Section id="pages" n={1} title={g.pages.title} labels={t.common}>
        <SectionBlocks s={g.pages} v={v} />
      </Section>

      <Section id="sharing" n={2} title={g.sharing.title} labels={t.common}>
        <SectionBlocks s={g.sharing} v={v} />
      </Section>

      <Section id="wrapped" n={3} title={g.wrapped.title} labels={t.common}>
        <SectionBlocks s={g.wrapped} v={v} />
      </Section>

      <Section id="events" n={4} title={g.events.title} labels={t.common}>
        <SectionBlocks s={g.events} v={v} />
      </Section>

      <Section id="compare" n={5} title={g.compare.title} labels={t.common}>
        <SectionBlocks s={g.compare} v={v} />
      </Section>
    </GuideShell>
  );
}
