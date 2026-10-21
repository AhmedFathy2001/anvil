import type { Metadata } from 'next';
import { GuideShell, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { items, rows, rt } from '../_i18n/rich';

// For a clan arriving from Dink (drop posts) and Wise Old Man (roster + competitions). Kept as plain
// as a guide can be: a handful of numbered steps per reader and four questions, no tables, no jargon.
// Whoever lands here is mid-move and wants the checklist, not the reasoning.

export async function switchingGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'switching', t.switching.metaTitle, t.switching.metaDescription);
}

export default async function SwitchingGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const s = t.switching;
  const { locale, languages, notice } = localeChrome(lang, 'switching', t.common);

  const SECTIONS = [
    { id: 'staff', n: 1, title: s.staff.title },
    { id: 'player', n: 2, title: s.player.title },
    { id: 'questions', n: 3, title: s.questions.title },
  ];

  return (
    <GuideShell
      eyebrow={s.eyebrow}
      title={s.title}
      sections={SECTIONS}
      minutes={3}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(s.dek)}
    >
      <Section id="staff" n={1} title={s.staff.title} labels={t.common}>
        <ol className="list-decimal pl-5 text-text-muted space-y-2">{items(s.staff.body)}</ol>
      </Section>

      <Section id="player" n={2} title={s.player.title} labels={t.common}>
        <ol className="list-decimal pl-5 text-text-muted space-y-2">{items(s.player.body)}</ol>
      </Section>

      <Section id="questions" n={3} title={s.questions.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.questions.intro)}</p>
        <Rows rows={rows(s.questions.rows)} />
      </Section>
    </GuideShell>
  );
}
