import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// Clan boosts for the Champion or Patron placing one and the clan staff reading the level. The rules
// live in lib/clanBoostRules (slots, seats, cooldown, levels, grace, perks, gifts, badges); the pages
// are /settings/boosts and /admin/clan/boosts. When a number changes there, the copy here has to too.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.boosts).
export const BOOSTS_SECTIONS = ['what', 'place', 'levels', 'perks', 'colours', 'staff', 'boosters'] as const;

export async function clanBoostsGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'clan-boosts', t.clanBoosts.metaTitle, t.clanBoosts.metaDescription);
}

export default async function ClanBoostsGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.clanBoosts;
  const { locale, languages, notice } = localeChrome(lang, 'clan-boosts', t.common);
  const v = { supporterGuide: guideHref(locale.code, 'supporter'), peopleGuide: guideHref(locale.code, 'people') };

  const SECTIONS = BOOSTS_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

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
      footnote={rt(`${g.footnote} ${t.common.legalPaid}`, v)}
    >
      <Section id="what" n={1} title={g.what.title} labels={t.common}>
        <SectionBlocks s={g.what} v={v} />
      </Section>

      <Section id="place" n={2} title={g.place.title} labels={t.common}>
        <SectionBlocks s={g.place} v={v} />
      </Section>

      <Section id="levels" n={3} title={g.levels.title} labels={t.common}>
        <SectionBlocks s={g.levels} v={v} />
      </Section>

      <Section id="perks" n={4} title={g.perks.title} labels={t.common}>
        <SectionBlocks s={g.perks} v={v} />
      </Section>

      <Section id="colours" n={5} title={g.colours.title} labels={t.common}>
        <SectionBlocks s={g.colours} v={v} />
      </Section>

      <Section id="staff" n={6} title={g.staff.title} labels={t.common}>
        <SectionBlocks s={g.staff} v={v} />
      </Section>

      <Section id="boosters" n={7} title={g.boosters.title} labels={t.common}>
        <SectionBlocks s={g.boosters} v={v} />
      </Section>
    </GuideShell>
  );
}
