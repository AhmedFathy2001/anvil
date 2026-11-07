import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { paragraphs, rows, rt } from '../_i18n/rich';

// Admin → People for the staff who work it: where a seat comes from (lib/guestAdmission admit, the
// in-game roster sync in api/plugin/clan-sync, a hand-added seat), what the Roster tab's filters mean,
// the two waiting queues and which tab each is on, the Who can join policy, and removing or banning.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.people).
export const PEOPLE_SECTIONS = ['roster', 'filters', 'review', 'policy', 'manual', 'removing', 'faq'] as const;

export async function peopleGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'people', t.people.metaTitle, t.people.metaDescription);
}

export default async function PeopleGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const p = t.people;
  const { locale, languages, notice } = localeChrome(lang, 'people', t.common);
  const v = { staffGuide: guideHref(locale.code, 'staff-roles') };

  const SECTIONS = PEOPLE_SECTIONS.map((id, i) => ({ id, n: i + 1, title: p[id].title }));

  return (
    <GuideShell
      eyebrow={p.eyebrow}
      title={p.title}
      sections={SECTIONS}
      minutes={6}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(p.dek, v)}
      facts={p.facts}
      footnote={rt(p.footnote, v)}
    >
      <Section id="roster" n={1} title={p.roster.title} labels={t.common}>
        {paragraphs(p.roster.body, v)}
        <Note tag={p.roster.note.tag}>
          <p>{rt(p.roster.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="filters" n={2} title={p.filters.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.filters.intro, v)}</p>
        <Rows rows={rows(p.filters.rows, v)} />
        <p className="text-text-muted">{rt(p.filters.outro, v)}</p>
        <Note tag={p.filters.note.tag}>
          <p>{rt(p.filters.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="review" n={3} title={p.review.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.review.intro, v)}</p>
        <Rows rows={rows(p.review.rows, v)} />
        <Note tag={p.review.note.tag}>
          <p>{rt(p.review.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="policy" n={4} title={p.policy.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.policy.intro, v)}</p>
        <Rows rows={rows(p.policy.rows, v)} />
        <p className="text-text-muted">{rt(p.policy.outro, v)}</p>
        <Note tag={p.policy.note.tag}>
          <p>{rt(p.policy.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="manual" n={5} title={p.manual.title} labels={t.common}>
        {paragraphs(p.manual.body, v)}
      </Section>

      <Section id="removing" n={6} title={p.removing.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.removing.intro, v)}</p>
        <Rows rows={rows(p.removing.rows, v)} />
        <Note tag={p.removing.note.tag}>
          <p>{rt(p.removing.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="faq" n={7} title={p.faq.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.faq.intro, v)}</p>
        <Rows rows={rows(p.faq.rows, v)} />
      </Section>
    </GuideShell>
  );
}
