import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// Skill/Boss of the Week (lib/weekly, lib/weeklyPrizes, app/admin/events/weekly/*, app/weekly/[id]).
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES).
export const WEEKLY_SECTIONS = ['schedule', 'counting', 'manage', 'prizes', 'players'] as const;

export async function weeklyGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'weekly', t.weekly.metaTitle, t.weekly.metaDescription);
}

export default async function WeeklyGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.weekly;
  const { locale, languages, notice } = localeChrome(lang, 'weekly', t.common);
  const v = { adminGuide: guideHref(locale.code, 'admin'), cofferGuide: guideHref(locale.code, 'coffer') };

  const SECTIONS = WEEKLY_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

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
      <Section id="schedule" n={1} title={g.schedule.title} labels={t.common}>
        <SectionBlocks s={g.schedule} v={v} />
      </Section>

      <Section id="counting" n={2} title={g.counting.title} labels={t.common}>
        <SectionBlocks s={g.counting} v={v} />
      </Section>

      <Section id="manage" n={3} title={g.manage.title} labels={t.common}>
        <SectionBlocks s={g.manage} v={v} />
      </Section>

      <Section id="prizes" n={4} title={g.prizes.title} labels={t.common}>
        <SectionBlocks s={g.prizes} v={v} />
      </Section>

      <Section id="players" n={5} title={g.players.title} labels={t.common}>
        <SectionBlocks s={g.players} v={v} />
      </Section>
    </GuideShell>
  );
}
