import type { Metadata } from 'next';
import { EVENT_MODES } from '@/lib/eventModes';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { paragraphs, rows, rt } from '../_i18n/rich';

// The two decisions that shape an event more than any tile in it. Format names come from
// lib/eventModes so the create form and this page can't describe the same choice differently;
// the dictionary may override them for a locale.

export async function formatsGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.formats.metaTitle, description: t.formats.metaDescription };
}

export default async function FormatsGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const f = t.formats;
  const { locale, languages, notice } = localeChrome(lang, 'formats', t.common);

  const v = { boardGuide: guideHref(locale.code, 'board') };

  const formatRows = EVENT_MODES.map((m) => {
    const override = t.admin.board.formats[m.key as keyof typeof t.admin.board.formats];
    return { term: override?.label || m.label, body: rt(override?.blurb || m.blurb) };
  });

  const SECTIONS = [
    { id: 'shape', n: 1, title: f.shape.title },
    { id: 'reveal', n: 2, title: f.reveal.title },
    { id: 'scoring', n: 3, title: f.scoring.title },
    { id: 'missions', n: 4, title: f.missions.title },
    { id: 'choose', n: 5, title: f.choose.title },
  ];

  return (
    <GuideShell
      eyebrow={f.eyebrow}
      title={f.title}
      sections={SECTIONS}
      minutes={5}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(f.dek, v)}
      facts={f.facts}
      footnote={rt(f.footnote, v)}
    >
      <Section id="shape" n={1} title={f.shape.title} labels={t.common}>
        <p className="text-text-muted">{rt(f.shape.intro, v)}</p>
        <Rows rows={formatRows} />
        <Note tag={f.shape.note.tag}>
          <p>{rt(f.shape.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="reveal" n={2} title={f.reveal.title} labels={t.common}>
        <p className="text-text-muted">{rt(f.reveal.intro, v)}</p>
        <Rows rows={rows(f.reveal.rows, v)} />
        <Note tag={f.reveal.note.tag}>
          <p>{rt(f.reveal.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="scoring" n={3} title={f.scoring.title} labels={t.common}>
        <p className="text-text-muted">{rt(f.scoring.intro, v)}</p>
        <Rows rows={rows(f.scoring.rows, v)} />
      </Section>

      <Section id="missions" n={4} title={f.missions.title} labels={t.common}>
        {paragraphs(f.missions.body, v)}
      </Section>

      <Section id="choose" n={5} title={f.choose.title} labels={t.common}>
        <p className="text-text-muted">{rt(f.choose.intro, v)}</p>
        <Rows rows={rows(f.choose.rows, v)} />
        <p className="text-text-muted">{rt(f.choose.outro, v)}</p>
      </Section>
    </GuideShell>
  );
}
