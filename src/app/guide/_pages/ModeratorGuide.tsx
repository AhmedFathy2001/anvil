import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict } from '../_i18n';
import { items, paragraphs, rows, rt } from '../_i18n/rich';

// The work that arrives whether or not an event is running. Written for someone on the rota tonight
// rather than for someone setting a clan up, which is what the admin guide already covers.

export async function moderatorGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.moderator.metaTitle, description: t.moderator.metaDescription };
}

export default async function ModeratorGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const m = t.moderator;
  const { locale, languages, notice } = localeChrome(lang, 'moderator', t.common);

  const SECTIONS = [
    { id: 'what', n: 1, title: m.what.title },
    { id: 'queue', n: 2, title: m.queue.title },
    { id: 'submissions', n: 3, title: m.submissions.title },
    { id: 'verify', n: 4, title: m.verify.title },
    { id: 'roster', n: 5, title: m.roster.title },
    { id: 'startshot', n: 6, title: m.startshot.title },
    { id: 'judgement', n: 7, title: m.judgement.title },
  ];

  return (
    <GuideShell
      eyebrow={m.eyebrow}
      title={m.title}
      sections={SECTIONS}
      minutes={5}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(m.dek)}
      facts={m.facts}
      footnote={rt(m.footnote)}
    >
      <Section id="what" n={1} title={m.what.title} labels={t.common}>
        <p className="text-text-muted">{rt(m.what.intro)}</p>
        <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">{items(m.what.canList)}</ul>
        <p className="text-text-muted">{rt(m.what.cantIntro)}</p>
        <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">{items(m.what.cantList)}</ul>
      </Section>

      <Section id="queue" n={2} title={m.queue.title} labels={t.common}>
        {paragraphs(m.queue.body)}
      </Section>

      <Section id="submissions" n={3} title={m.submissions.title} labels={t.common}>
        {paragraphs(m.submissions.body)}
        <Rows rows={rows(m.submissions.rows)} />
      </Section>

      <Section id="verify" n={4} title={m.verify.title} labels={t.common}>
        <p className="text-text-muted">{rt(m.verify.intro)}</p>
        <Rows rows={rows(m.verify.rows)} />
        <Note tag={m.verify.note.tag}>
          <p>{rt(m.verify.note.body)}</p>
        </Note>
      </Section>

      <Section id="roster" n={5} title={m.roster.title} labels={t.common}>
        {paragraphs(m.roster.body)}
        <Note tag={m.roster.note.tag}>
          <p>{rt(m.roster.note.body)}</p>
        </Note>
      </Section>

      <Section id="startshot" n={6} title={m.startshot.title} labels={t.common}>
        {paragraphs(m.startshot.body)}
      </Section>

      <Section id="judgement" n={7} title={m.judgement.title} labels={t.common}>
        <p className="text-text-muted">{rt(m.judgement.intro)}</p>
        <Rows rows={rows(m.judgement.rows)} />
      </Section>
    </GuideShell>
  );
}
