import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { items, paragraphs, rows, rt } from '../_i18n/rich';
import { apexDomain } from '@/lib/clanContext';

// The host's guide for a creator space (lib/creatorSpaces): a streamer with an audience and no
// in-game clan. The admin sidebar's "Admin guide" lands here for a creator space, so it is written
// for somebody who has never used Anvil — one step per screen they will meet, in the order they meet
// them, with the button names verbatim. Limits mirror lib/creatorCatalog; gate wording mirrors
// lib/entryGates and components/EntryGatePicker.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.creators).
export const CREATORS_SECTIONS = [
  'what',
  'create',
  'first',
  'share',
  'who',
  'approve',
  'channels',
  'overlay',
  'chatjoin',
  'listing',
  'plans',
  'faq',
] as const;

export async function creatorsGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'creators', t.creators.metaTitle, t.creators.metaDescription);
}

export default async function CreatorsGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const c = t.creators;
  const { locale, languages, notice } = localeChrome(lang, 'creators', t.common);
  const v = {
    apex: apexDomain(),
    pluginGuide: guideHref(locale.code, 'plugin'),
    joiningGuide: guideHref(locale.code, 'joining-a-streamer-event'),
    streamingGuide: guideHref(locale.code, 'streaming-for-clans'),
  };

  const SECTIONS = CREATORS_SECTIONS.map((id, i) => ({ id, n: i + 1, title: c[id].title }));
  const list = 'list-disc ps-5 text-text-muted space-y-2';

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
    >
      <Section id="what" n={1} title={c.what.title} labels={t.common}>
        {paragraphs(c.what.body, v)}
      </Section>

      <Section id="create" n={2} title={c.create.title} labels={t.common}>
        <ol className="list-decimal ps-5 text-text-muted space-y-2">{items(c.create.body, v)}</ol>
      </Section>

      <Section id="first" n={3} title={c.first.title} labels={t.common}>
        <ul className={list}>{items(c.first.body, v)}</ul>
      </Section>

      <Section id="share" n={4} title={c.share.title} labels={t.common}>
        {paragraphs(c.share.body, v)}
      </Section>

      <Section id="who" n={5} title={c.who.title} labels={t.common}>
        {paragraphs(c.who.body, v)}
        <p className="text-text-muted">{rt(c.who.intro, v)}</p>
        <Rows rows={rows(c.who.rows, v)} />
        <Note tag={c.who.note.tag}>
          <p>{rt(c.who.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="approve" n={6} title={c.approve.title} labels={t.common} optional>
        {paragraphs(c.approve.body, v)}
      </Section>

      <Section id="channels" n={7} title={c.channels.title} labels={t.common}>
        {paragraphs(c.channels.body, v)}
      </Section>

      <Section id="overlay" n={8} title={c.overlay.title} labels={t.common} optional>
        {paragraphs(c.overlay.body, v)}
        <p className="font-medium">{c.overlay.stepsTitle}</p>
        <ol className="list-decimal ps-5 text-text-muted space-y-2">{items(c.overlay.steps, v)}</ol>
        <Note tag={c.overlay.tipsTag}>
          <ul className="list-disc ps-5 space-y-1.5">{items(c.overlay.tips, v)}</ul>
        </Note>
      </Section>

      <Section id="chatjoin" n={9} title={c.chatjoin.title} labels={t.common} optional>
        {paragraphs(c.chatjoin.body, v)}
        <Note tag={c.overlay.tipsTag}>
          <ul className="list-disc ps-5 space-y-1.5">{items(c.chatjoin.tips, v)}</ul>
        </Note>
      </Section>

      <Section id="listing" n={10} title={c.listing.title} labels={t.common} optional>
        {paragraphs(c.listing.body, v)}
      </Section>

      <Section id="plans" n={11} title={c.plans.title} labels={t.common}>
        {paragraphs(c.plans.body, v)}
        <Rows rows={rows(c.plans.rows, v)} />
        <Note tag={c.plans.note.tag} tone="green">
          <p>{rt(c.plans.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="faq" n={12} title={c.faq.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.faq.intro, v)}</p>
        <Rows rows={rows(c.faq.rows, v)} />
      </Section>
    </GuideShell>
  );
}
