import type { Metadata } from 'next';
import { apexDomain } from '@/lib/clanContext';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { paragraphs, rows, rt } from '../_i18n/rich';

export async function clanGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.clan.metaTitle, description: t.clan.metaDescription };
}

/**
 * Starting a clan.
 *
 * The guide that did not exist while making a clan was a purchase: there was nothing to explain that
 * the checkout did not already walk you through, and the interesting part happened on our side. It
 * is now a form and an INSERT, which means the reader is doing the whole thing themselves and the
 * two decisions in it — the in-game name, and the address — are theirs to get right first time.
 *
 * Deliberately renders on the apex as happily as inside a clan: the person reading this does not
 * have a clan yet, so anything that needed one would 404 exactly the reader it is for.
 */
export default async function ClanGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const c = t.clan;
  const { locale, languages, notice } = localeChrome(lang, 'clan', t.common);

  const apex = apexDomain();
  const v = {
    apex,
    pluginGuide: guideHref(locale.code, 'plugin'),
    adminGuide: guideHref(locale.code, 'admin'),
    clanVsClanGuide: guideHref(locale.code, 'clan-vs-clan'),
    boardGuide: guideHref(locale.code, 'board'),
    moderatorGuide: guideHref(locale.code, 'moderator'),
  };

  const SECTIONS = [
    { id: 'before', n: 1, title: c.before.title },
    { id: 'create', n: 2, title: c.create.title },
    { id: 'live', n: 3, title: c.live.title },
    { id: 'setup', n: 4, title: c.setup.title },
    { id: 'members', n: 5, title: c.members.title },
    { id: 'first', n: 6, title: c.first.title },
    { id: 'together', n: 7, title: c.together.title },
  ];

  return (
    <GuideShell
      eyebrow={c.eyebrow}
      title={c.title}
      sections={SECTIONS}
      minutes={4}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(c.dek, v)}
      facts={c.facts}
      footnote={rt(c.footnote, v)}
    >
      {/* ---------------------------------------------------------------- 1 */}
      <Section id="before" n={1} title={c.before.title} labels={t.common}>
        {paragraphs(c.before.body, v)}
        <Note tag={c.before.note.tag}>{rt(c.before.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 2 */}
      <Section id="create" n={2} title={c.create.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.create.intro, v)}</p>
        <Rows rows={rows(c.create.fields, v)} />
        <Note tag={c.create.note.tag}>{rt(c.create.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 3 */}
      <Section id="live" n={3} title={c.live.title} labels={t.common}>
        {paragraphs(c.live.body, v)}
      </Section>

      {/* ---------------------------------------------------------------- 4 */}
      <Section id="setup" n={4} title={c.setup.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.setup.intro, v)}</p>
        <Rows rows={rows(c.setup.steps, v)} />
        {paragraphs(c.setup.after, v)}
      </Section>

      {/* ---------------------------------------------------------------- 5 */}
      <Section id="members" n={5} title={c.members.title} labels={t.common}>
        {paragraphs(c.members.body, v)}
        <Rows rows={rows(c.members.ways, v)} />
        <Note tag={c.members.note.tag}>{rt(c.members.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 6 */}
      <Section id="first" n={6} title={c.first.title} labels={t.common}>
        {paragraphs(c.first.body, v)}
      </Section>

      {/* ---------------------------------------------------------------- 7 */}
      <Section id="together" n={7} title={c.together.title} labels={t.common}>
        {paragraphs(c.together.body, v)}
        <Note tag={c.together.note.tag}>{rt(c.together.note.body, v)}</Note>
      </Section>
    </GuideShell>
  );
}
