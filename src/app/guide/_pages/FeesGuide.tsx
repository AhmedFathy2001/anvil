import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict } from '../_i18n';
import { paragraphs, rows, rt } from '../_i18n/rich';

// The treasurer's path. Deliberately says WHY the second signature exists and why the count can be
// zero — the rule reads as bureaucracy until you know it's separation of duties, and a clan whose
// treasurer is the owner needs permission to switch it off rather than a queue it can never clear.

export async function feesGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.fees.metaTitle, description: t.fees.metaDescription };
}

export default async function FeesGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const f = t.fees;
  const { locale, languages, notice } = localeChrome(lang, 'fees', t.common);

  const SECTIONS = [
    { id: 'set', n: 1, title: f.set.title },
    { id: 'collect', n: 2, title: f.collect.title },
    { id: 'sign', n: 3, title: f.sign.title },
    { id: 'pay', n: 4, title: f.pay.title },
    { id: 'disputes', n: 5, title: f.disputes.title },
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
      dek={rt(f.dek)}
      facts={f.facts}
      footnote={rt(f.footnote)}
    >
      <Section id="set" n={1} title={f.set.title} labels={t.common}>
        {paragraphs(f.set.body)}
        <Rows rows={rows(f.set.rows)} />
        <Note tag={f.set.note.tag}>
          <p>{rt(f.set.note.body)}</p>
        </Note>
      </Section>

      <Section id="collect" n={2} title={f.collect.title} labels={t.common}>
        {paragraphs(f.collect.body)}
        <Note tag={f.collect.note.tag}>
          <p>{rt(f.collect.note.body)}</p>
        </Note>
      </Section>

      <Section id="sign" n={3} title={f.sign.title} labels={t.common}>
        {paragraphs(f.sign.body)}
      </Section>

      <Section id="pay" n={4} title={f.pay.title} labels={t.common}>
        {paragraphs(f.pay.body)}
        <Note tag={f.pay.note.tag}>
          <p>{rt(f.pay.note.body)}</p>
        </Note>
      </Section>

      <Section id="disputes" n={5} title={f.disputes.title} labels={t.common}>
        <p className="text-text-muted">{rt(f.disputes.intro)}</p>
        <Rows rows={rows(f.disputes.rows)} />
      </Section>
    </GuideShell>
  );
}
