import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { items, paragraphs, rows, rt } from '../_i18n/rich';

// For a viewer who clicked a streamer's link (a creator space's event, or a Streaming clan's event
// open to viewers). Assumes nothing: no clan, no Anvil login, maybe no plugin. The button names are
// the join card's own (app/events/[eventId]/EnterEvent, YoutubeGate, components/KickLinkCode), and
// the FAQ quotes the messages a viewer actually sees (lib/entryGates, lib/creatorPlans).
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.joining).
export const JOINING_SECTIONS = ['join', 'gated', 'plugin', 'play', 'accounts', 'faq'] as const;

export async function joiningStreamGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'joining-a-streamer-event', t.joiningStream.metaTitle, t.joiningStream.metaDescription);
}

export default async function JoiningStreamGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const j = t.joiningStream;
  const { locale, languages, notice } = localeChrome(lang, 'joining-a-streamer-event', t.common);
  const v = { pluginGuide: guideHref(locale.code, 'plugin') };

  const SECTIONS = JOINING_SECTIONS.map((id, i) => ({ id, n: i + 1, title: j[id].title }));

  return (
    <GuideShell
      eyebrow={j.eyebrow}
      title={j.title}
      sections={SECTIONS}
      minutes={2}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(j.dek, v)}
      facts={j.facts}
    >
      <Section id="join" n={1} title={j.join.title} labels={t.common}>
        <ol className="list-decimal ps-5 text-text-muted space-y-2">{items(j.join.body, v)}</ol>
      </Section>

      <Section id="gated" n={2} title={j.gated.title} labels={t.common} optional>
        {paragraphs(j.gated.body, v)}
        <p className="text-text-muted">{rt(j.gated.intro, v)}</p>
        <Rows rows={rows(j.gated.rows, v)} />
        <Note tag={j.gated.note.tag}>
          <p>{rt(j.gated.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="plugin" n={3} title={j.plugin.title} labels={t.common}>
        {paragraphs(j.plugin.body, v)}
      </Section>

      <Section id="play" n={4} title={j.play.title} labels={t.common}>
        {paragraphs(j.play.body, v)}
      </Section>

      <Section id="accounts" n={5} title={j.accounts.title} labels={t.common} optional>
        {paragraphs(j.accounts.body, v)}
      </Section>

      <Section id="faq" n={6} title={j.faq.title} labels={t.common}>
        <p className="text-text-muted">{rt(j.faq.intro, v)}</p>
        <Rows rows={rows(j.faq.rows, v)} />
      </Section>
    </GuideShell>
  );
}
