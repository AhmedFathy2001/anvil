import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// Anvil Supporter for the player deciding or already paying: the tiers (lib/supporterTiers), name
// colours and their dark/light looks (lib/supporterStyle), profile media and the display case
// (lib/profileMediaRules), friend events, head-to-head and chat pace (friendEventRules, h2hRules,
// eventChatRules), Gumroad billing (lib/supporter) and what a lapse does. When a tier's numbers
// change in one of those, the compare table here has to too.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.supporter).
export const SUPPORTER_SECTIONS = ['tiers', 'compare', 'names', 'where', 'profile', 'hosting', 'billing', 'lapse'] as const;

export async function supporterGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'supporter', t.supporter.metaTitle, t.supporter.metaDescription);
}

export default async function SupporterGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.supporter;
  const { locale, languages, notice } = localeChrome(lang, 'supporter', t.common);
  const v = { boostsGuide: guideHref(locale.code, 'clan-boosts'), panelGuide: guideHref(locale.code, 'side-panel') };

  const SECTIONS = SUPPORTER_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

  return (
    <GuideShell
      eyebrow={g.eyebrow}
      title={g.title}
      sections={SECTIONS}
      minutes={6}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(g.dek, v)}
      facts={g.facts}
      footnote={rt(g.footnote, v)}
    >
      <Section id="tiers" n={1} title={g.tiers.title} labels={t.common}>
        <SectionBlocks s={g.tiers} v={v} />
      </Section>

      <Section id="compare" n={2} title={g.compare.title} labels={t.common}>
        <SectionBlocks s={g.compare} v={v} />
      </Section>

      <Section id="names" n={3} title={g.names.title} labels={t.common}>
        <SectionBlocks s={g.names} v={v} />
      </Section>

      <Section id="where" n={4} title={g.where.title} labels={t.common}>
        <SectionBlocks s={g.where} v={v} />
      </Section>

      <Section id="profile" n={5} title={g.profile.title} labels={t.common}>
        <SectionBlocks s={g.profile} v={v} />
      </Section>

      <Section id="hosting" n={6} title={g.hosting.title} labels={t.common}>
        <SectionBlocks s={g.hosting} v={v} />
      </Section>

      <Section id="billing" n={7} title={g.billing.title} labels={t.common}>
        <SectionBlocks s={g.billing} v={v} />
      </Section>

      <Section id="lapse" n={8} title={g.lapse.title} labels={t.common}>
        <SectionBlocks s={g.lapse} v={v} />
      </Section>
    </GuideShell>
  );
}
