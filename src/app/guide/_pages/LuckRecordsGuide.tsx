import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// Drop odds, luck and records (components/DropOdds, lib/dropOdds, lib/clogLuck, lib/records, lib/efficiency).
export const LUCK_RECORDS_SECTIONS = ['odds', 'luck', 'source', 'records'] as const;

export async function luckRecordsGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'luck-and-records', t.luckRecords.metaTitle, t.luckRecords.metaDescription);
}

export default async function LuckRecordsGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.luckRecords;
  const { locale, languages, notice } = localeChrome(lang, 'luck-and-records', t.common);
  const v = { profileGuide: guideHref(locale.code, 'profile'), settingsGuide: guideHref(locale.code, 'settings') };

  const SECTIONS = LUCK_RECORDS_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

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
      <Section id="odds" n={1} title={g.odds.title} labels={t.common}>
        <SectionBlocks s={g.odds} v={v} />
      </Section>

      <Section id="luck" n={2} title={g.luck.title} labels={t.common}>
        <SectionBlocks s={g.luck} v={v} />
      </Section>

      <Section id="source" n={3} title={g.source.title} labels={t.common}>
        <SectionBlocks s={g.source} v={v} />
      </Section>

      <Section id="records" n={4} title={g.records.title} labels={t.common}>
        <SectionBlocks s={g.records} v={v} />
      </Section>
    </GuideShell>
  );
}
