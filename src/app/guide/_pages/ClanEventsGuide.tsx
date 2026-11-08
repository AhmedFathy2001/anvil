import type { Metadata } from 'next';
import { GuideShell, Section } from '../_components/GuideUI';
import { SectionBlocks } from '../_components/SectionBlocks';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// Clan events (lib/clanEvents, app/admin/clan-events, app/clan-events/[id]) and the schedule (app/admin/schedule).
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES).
export const CLAN_EVENT_SECTIONS = ['create', 'discord', 'manage', 'players', 'calendar'] as const;

export async function clanEventsGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'clan-events', t.clanEvents.metaTitle, t.clanEvents.metaDescription);
}

export default async function ClanEventsGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.clanEvents;
  const { locale, languages, notice } = localeChrome(lang, 'clan-events', t.common);
  const v = { weeklyGuide: guideHref(locale.code, 'weekly'), feesGuide: guideHref(locale.code, 'fees'), settingsGuide: guideHref(locale.code, 'settings') };

  const SECTIONS = CLAN_EVENT_SECTIONS.map((id, i) => ({ id, n: i + 1, title: g[id].title }));

  return (
    <GuideShell
      eyebrow={g.eyebrow}
      title={g.title}
      sections={SECTIONS}
      minutes={4}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(g.dek, v)}
      facts={g.facts}
      footnote={rt(g.footnote, v)}
    >
      <Section id="create" n={1} title={g.create.title} labels={t.common}>
        <SectionBlocks s={g.create} v={v} />
      </Section>

      <Section id="discord" n={2} title={g.discord.title} labels={t.common}>
        <SectionBlocks s={g.discord} v={v} />
      </Section>

      <Section id="manage" n={3} title={g.manage.title} labels={t.common}>
        <SectionBlocks s={g.manage} v={v} />
      </Section>

      <Section id="players" n={4} title={g.players.title} labels={t.common}>
        <SectionBlocks s={g.players} v={v} />
      </Section>

      <Section id="calendar" n={5} title={g.calendar.title} labels={t.common}>
        <SectionBlocks s={g.calendar} v={v} />
      </Section>
    </GuideShell>
  );
}
