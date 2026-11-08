import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// Head-to-head challenges (lib/h2hRules, lib/h2h) and Supporter friends events (lib/friendEventRules FRIENDS_CAPS).
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES).
export const CHALLENGE_SECTIONS = ['start', 'rules', 'limits', 'friends'] as const;

export async function challengesGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'challenges', t.challenges.metaTitle, t.challenges.metaDescription);
}

export default async function ChallengesGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.challenges;
  const { locale, languages, notice } = localeChrome(lang, 'challenges', t.common);
  const v = { supporterGuide: guideHref(locale.code, 'supporter') };

  const SECTIONS = CHALLENGE_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

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
      <Section id="start" n={1} title={g.start.title} labels={t.common}>
        <SectionBlocks s={g.start} v={v} />
      </Section>

      <Section id="rules" n={2} title={g.rules.title} labels={t.common}>
        <SectionBlocks s={g.rules} v={v} />
      </Section>

      <Section id="limits" n={3} title={g.limits.title} labels={t.common}>
        <SectionBlocks s={g.limits} v={v} />
      </Section>

      <Section id="friends" n={4} title={g.friends.title} labels={t.common}>
        <SectionBlocks s={g.friends} v={v} />
      </Section>
    </GuideShell>
  );
}
