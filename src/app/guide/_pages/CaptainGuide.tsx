import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { paragraphs, rows, rt } from '../_i18n/rich';

// Draft day shipped a war room, a shortlist and a pick clock, and none of it was ever written up.
// Every event hands this UI to people who have never seen it, under a clock, in front of an audience.

export async function captainGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.captain.metaTitle, description: t.captain.metaDescription };
}

export default async function CaptainGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const c = t.captain;
  const { locale, languages, notice } = localeChrome(lang, 'captain', t.common);

  const v = { clanVsClanGuide: guideHref(locale.code, 'clan-vs-clan') };

  const SECTIONS = [
    { id: 'before', n: 1, title: c.before.title },
    { id: 'warroom', n: 2, title: c.warroom.title },
    { id: 'draft', n: 3, title: c.draft.title },
    { id: 'roster', n: 4, title: c.roster.title },
    { id: 'during', n: 5, title: c.during.title },
  ];

  return (
    <GuideShell
      eyebrow={c.eyebrow}
      title={c.title}
      sections={SECTIONS}
      minutes={6}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(c.dek, v)}
      facts={c.facts}
      footnote={rt(c.footnote, v)}
    >
      <Section id="before" n={1} title={c.before.title} labels={t.common}>
        {paragraphs(c.before.body, v)}
        <Note tag={c.before.note.tag}>
          <p>{rt(c.before.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="warroom" n={2} title={c.warroom.title} labels={t.common}>
        {paragraphs(c.warroom.body, v)}
        <Rows rows={rows(c.warroom.rows, v)} />
      </Section>

      <Section id="draft" n={3} title={c.draft.title} labels={t.common}>
        {paragraphs(c.draft.body, v)}
        <Rows rows={rows(c.draft.rows, v)} />
        <Note tag={c.draft.note.tag}>
          <p>{rt(c.draft.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="roster" n={4} title={c.roster.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.roster.intro, v)}</p>
        <Rows rows={rows(c.roster.rows, v)} />
      </Section>

      <Section id="during" n={5} title={c.during.title} labels={t.common}>
        {paragraphs(c.during.body, v)}
        <Note tag={c.during.note.tag}>
          <p>{rt(c.during.note.body, v)}</p>
        </Note>
      </Section>
    </GuideShell>
  );
}
