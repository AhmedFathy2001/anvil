import type { Metadata } from 'next';
import { GuideShell, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { paragraphs, rows, rt } from '../_i18n/rich';

// A public clan turning on Streaming (lib/streamingSwitch, lib/creatorSpaces streamedEvent). Only what
// differs from a creator space — the switch, the per-event "Members only / Members and viewers", and
// what a viewer becomes. The shared streamer tools are explained once, in the creators guide.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.streamingclans).
export const STREAMING_SECTIONS = ['on', 'event', 'viewers', 'tools', 'faq'] as const;

export async function streamingClansGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'streaming-for-clans', t.streamingClans.metaTitle, t.streamingClans.metaDescription);
}

export default async function StreamingClansGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const s = t.streamingClans;
  const { locale, languages, notice } = localeChrome(lang, 'streaming-for-clans', t.common);
  const v = { creatorsGuide: guideHref(locale.code, 'creators') };

  const SECTIONS = STREAMING_SECTIONS.map((id, i) => ({ id, n: i + 1, title: s[id].title }));

  return (
    <GuideShell
      eyebrow={s.eyebrow}
      title={s.title}
      sections={SECTIONS}
      minutes={2}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(s.dek, v)}
    >
      <Section id="on" n={1} title={s.on.title} labels={t.common}>
        {paragraphs(s.on.body, v)}
      </Section>

      <Section id="event" n={2} title={s.event.title} labels={t.common}>
        {paragraphs(s.event.body, v)}
      </Section>

      <Section id="viewers" n={3} title={s.viewers.title} labels={t.common}>
        {paragraphs(s.viewers.body, v)}
      </Section>

      <Section id="tools" n={4} title={s.tools.title} labels={t.common}>
        {paragraphs(s.tools.body, v)}
      </Section>

      <Section id="faq" n={5} title={s.faq.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.faq.intro, v)}</p>
        <Rows rows={rows(s.faq.rows, v)} />
      </Section>
    </GuideShell>
  );
}
