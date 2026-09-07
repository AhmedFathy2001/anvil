import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { paragraphs, rows, rt } from '../_i18n/rich';

// The money page for a clan rather than for one event — the fees guide covers an event's entry fee
// and its payouts, this covers the pot both of those draw on. Split because they are different jobs
// on different days: fees are a queue during sign-ups, the coffer is a standing balance.

export async function cofferGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'coffer', t.coffer.metaTitle, t.coffer.metaDescription);
}

export default async function CofferGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const c = t.coffer;
  const { locale, languages, notice } = localeChrome(lang, 'coffer', t.common);
  const vars = { discordGuide: guideHref(locale.code, 'discord') };

  const SECTIONS = [
    { id: 'what', n: 1, title: c.what.title },
    { id: 'in', n: 2, title: c.inbound.title },
    { id: 'out', n: 3, title: c.out.title },
    { id: 'who', n: 4, title: c.who.title },
    { id: 'short', n: 5, title: c.short.title },
  ];

  return (
    <GuideShell
      eyebrow={c.eyebrow}
      title={c.title}
      sections={SECTIONS}
      minutes={5}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(c.dek)}
      facts={c.facts}
      footnote={rt(c.footnote)}
    >
      <Section id="what" n={1} title={c.what.title} labels={t.common}>
        {paragraphs(c.what.body)}
        <Rows rows={rows(c.what.rows)} />
        <Note tag={c.what.note.tag}>
          <p>{rt(c.what.note.body)}</p>
        </Note>
      </Section>

      <Section id="in" n={2} title={c.inbound.title} labels={t.common}>
        {paragraphs(c.inbound.body)}
        <Rows rows={rows(c.inbound.rows)} />
        <Note tag={c.inbound.note.tag}>
          <p>{rt(c.inbound.note.body)}</p>
        </Note>
      </Section>

      <Section id="out" n={3} title={c.out.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.out.intro)}</p>
        <Rows rows={rows(c.out.rows)} />
        <Note tag={c.out.note.tag}>
          <p>{rt(c.out.note.body)}</p>
        </Note>
      </Section>

      <Section id="who" n={4} title={c.who.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.who.intro)}</p>
        <Rows rows={rows(c.who.rows)} />
        <Note tag={c.who.note.tag}>
          <p>{rt(c.who.note.body, vars)}</p>
        </Note>
      </Section>

      <Section id="short" n={5} title={c.short.title} labels={t.common}>
        {paragraphs(c.short.body)}
        <Note tag={c.short.note.tag}>
          <p>{rt(c.short.note.body)}</p>
        </Note>
      </Section>
    </GuideShell>
  );
}
