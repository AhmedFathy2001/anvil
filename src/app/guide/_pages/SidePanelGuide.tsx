import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// The RuneLite side panel for the player using it. The panel's frame and settings are the plugin's
// (Anvil.Plugin AnvilSidebarPanel, AnvilConfig); what its tabs show is served from lib/pluginUi, event
// chat from lib/eventChat(Rules), reactions from lib/reactionAccess. Anything only on the plugin's
// unreleased branch says "in the next plugin update" in the copy; drop that once it ships.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.sidepanel).
export const PANEL_SECTIONS = ['header', 'clan', 'feed', 'reactions', 'chat', 'you', 'gear', 'settings'] as const;

export async function sidePanelGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'side-panel', t.sidePanel.metaTitle, t.sidePanel.metaDescription);
}

export default async function SidePanelGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.sidePanel;
  const { locale, languages, notice } = localeChrome(lang, 'side-panel', t.common);
  const v = { pluginGuide: guideHref(locale.code, 'plugin'), supporterGuide: guideHref(locale.code, 'supporter') };

  const SECTIONS = PANEL_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

  return (
    <GuideShell
      eyebrow={g.eyebrow}
      title={g.title}
      sections={SECTIONS}
      minutes={6}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(g.dek, v)}
      facts={g.facts}
      footnote={rt(g.footnote, v)}
    >
      <Section id="header" n={1} title={g.header.title} labels={t.common}>
        <SectionBlocks s={g.header} v={v} />
      </Section>

      <Section id="clan" n={2} title={g.clan.title} labels={t.common}>
        <SectionBlocks s={g.clan} v={v} />
      </Section>

      <Section id="feed" n={3} title={g.feed.title} labels={t.common}>
        <SectionBlocks s={g.feed} v={v} />
      </Section>

      <Section id="reactions" n={4} title={g.reactions.title} labels={t.common}>
        <SectionBlocks s={g.reactions} v={v} />
      </Section>

      <Section id="chat" n={5} title={g.chat.title} labels={t.common}>
        <SectionBlocks s={g.chat} v={v} />
      </Section>

      <Section id="you" n={6} title={g.you.title} labels={t.common}>
        <SectionBlocks s={g.you} v={v} />
      </Section>

      <Section id="gear" n={7} title={g.gear.title} labels={t.common}>
        <SectionBlocks s={g.gear} v={v} />
      </Section>

      <Section id="settings" n={8} title={g.settings.title} labels={t.common}>
        <SectionBlocks s={g.settings} v={v} />
      </Section>
    </GuideShell>
  );
}
