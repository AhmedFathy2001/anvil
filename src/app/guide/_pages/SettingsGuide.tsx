import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// /settings page by page (app/settings/*; post defaults lib/notifyPrefs NOTIFY_DEFAULTS, claims lib/ownershipClaims).
// The Discord posts page is read by the plugin's next update (capability 'notify-prefs'); the copy says so.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES).
export const SETTINGS_SECTIONS = ['find', 'posts', 'chat', 'login', 'webhooks', 'privacy', 'look', 'characters', 'claims'] as const;

export async function settingsGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'settings', t.settings.metaTitle, t.settings.metaDescription);
}

export default async function SettingsGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.settings;
  const { locale, languages, notice } = localeChrome(lang, 'settings', t.common);
  const v = { profileGuide: guideHref(locale.code, 'profile'), pluginGuide: guideHref(locale.code, 'plugin'), supporterGuide: guideHref(locale.code, 'supporter'), boostsGuide: guideHref(locale.code, 'clan-boosts') };

  const SECTIONS = SETTINGS_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

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
      <Section id="find" n={1} title={g.find.title} labels={t.common}>
        <SectionBlocks s={g.find} v={v} />
      </Section>

      <Section id="posts" n={2} title={g.posts.title} labels={t.common}>
        <SectionBlocks s={g.posts} v={v} />
      </Section>

      <Section id="chat" n={3} title={g.chat.title} labels={t.common}>
        <SectionBlocks s={g.chat} v={v} />
      </Section>

      <Section id="login" n={4} title={g.login.title} labels={t.common}>
        <SectionBlocks s={g.login} v={v} />
      </Section>

      <Section id="webhooks" n={5} title={g.webhooks.title} labels={t.common}>
        <SectionBlocks s={g.webhooks} v={v} />
      </Section>

      <Section id="privacy" n={6} title={g.privacy.title} labels={t.common}>
        <SectionBlocks s={g.privacy} v={v} />
      </Section>

      <Section id="look" n={7} title={g.look.title} labels={t.common}>
        <SectionBlocks s={g.look} v={v} />
      </Section>

      <Section id="characters" n={8} title={g.characters.title} labels={t.common}>
        <SectionBlocks s={g.characters} v={v} />
      </Section>

      <Section id="claims" n={9} title={g.claims.title} labels={t.common}>
        <SectionBlocks s={g.claims} v={v} />
      </Section>
    </GuideShell>
  );
}
