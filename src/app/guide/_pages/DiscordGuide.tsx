import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { paragraphs, rows, rt } from '../_i18n/rich';

export async function discordGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'discord', t.discord.metaTitle, t.discord.metaDescription);
}

/**
 * Anvil in Discord.
 *
 * The Discord setup was documented three times over — a step in the clan guide, a step in the admin
 * guide, and the help text on four settings tabs — and none of them was the place to look when it
 * had already been set up and had stopped working. That is the gap this fills: the ordering that
 * matters when you have never done it, and the four checks that matter on the day it goes quiet.
 *
 * The failure it exists for is the silent one. Role and nickname sync do nothing at all when the
 * bot's role sits below the roles it manages, and Discord reports that to nobody — so the symptom
 * is an admin who has enabled a feature, saved a form, seen no error, and has no next move.
 */
export default async function DiscordGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const c = t.discord;
  const { locale, languages, notice } = localeChrome(lang, 'discord', t.common);

  const v = {
    pluginGuide: guideHref(locale.code, 'plugin'),
    adminGuide: guideHref(locale.code, 'admin'),
    clanGuide: guideHref(locale.code, 'clan'),
    moderatorGuide: guideHref(locale.code, 'moderator'),
    commandsGuide: guideHref(locale.code, 'commands'),
    settingsGuide: guideHref(locale.code, 'settings'),
  };

  const SECTIONS = [
    { id: 'bot', n: 1, title: c.bot.title },
    { id: 'connect', n: 2, title: c.connect.title },
    { id: 'channels', n: 3, title: c.channels.title },
    { id: 'modes', n: 4, title: c.modes.title },
    { id: 'cleanup', n: 5, title: c.cleanup.title },
    { id: 'roles', n: 6, title: c.roles.title },
    { id: 'commands', n: 7, title: c.commands.title },
    { id: 'posts', n: 8, title: c.posts.title },
    { id: 'drops', n: 9, title: c.drops.title },
    { id: 'pools', n: 10, title: c.pools.title },
    { id: 'announce', n: 11, title: c.announce.title },
    { id: 'quiet', n: 12, title: c.quiet.title },
  ];

  return (
    <GuideShell
      eyebrow={c.eyebrow}
      title={c.title}
      sections={SECTIONS}
      minutes={7}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(c.dek, v)}
      facts={c.facts}
      footnote={rt(c.footnote, v)}
    >
      {/* ---------------------------------------------------------------- 1 */}
      <Section id="bot" n={1} title={c.bot.title} labels={t.common}>
        {paragraphs(c.bot.body, v)}
        <Rows rows={rows(c.bot.permissions, v)} />
        <Note tag={c.bot.note.tag}>{rt(c.bot.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 2 */}
      <Section id="connect" n={2} title={c.connect.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.connect.intro, v)}</p>
        <Rows rows={rows(c.connect.steps, v)} />
        {paragraphs(c.connect.after, v)}
        <Note tag={c.connect.note.tag}>{rt(c.connect.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 3 */}
      <Section id="channels" n={3} title={c.channels.title} labels={t.common}>
        {paragraphs(c.channels.body, v)}
        <Rows rows={rows(c.channels.feeds, v)} />
        <Note tag={c.channels.note.tag}>{rt(c.channels.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 4 */}
      <Section id="modes" n={4} title={c.modes.title} labels={t.common}>
        {paragraphs(c.modes.body, v)}
        <Note tag={c.modes.note.tag}>{rt(c.modes.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 5 */}
      <Section id="cleanup" n={5} title={c.cleanup.title} labels={t.common}>
        {paragraphs(c.cleanup.body, v)}
        <Note tag={c.cleanup.note.tag}>{rt(c.cleanup.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 6 */}
      <Section id="roles" n={6} title={c.roles.title} labels={t.common}>
        {paragraphs(c.roles.body, v)}
        <Rows rows={rows(c.roles.ways, v)} />
        <Note tag={c.roles.note.tag}>{rt(c.roles.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 7 */}
      <Section id="commands" n={7} title={c.commands.title} labels={t.common}>
        {paragraphs(c.commands.body, v)}
        <Note tag={c.commands.note.tag}>{rt(c.commands.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 8 */}
      <Section id="posts" n={8} title={c.posts.title} labels={t.common}>
        {paragraphs(c.posts.body, v)}
        <Note tag={c.posts.note.tag}>{rt(c.posts.note.body, v)}</Note>
      </Section>

      <Section id="drops" n={9} title={c.drops.title} labels={t.common}>
        {paragraphs(c.drops.body, v)}
        <Note tag={c.drops.note.tag}>{rt(c.drops.note.body, v)}</Note>
      </Section>

      <Section id="pools" n={10} title={c.pools.title} labels={t.common}>
        {paragraphs(c.pools.body, v)}
        <Note tag={c.pools.note.tag}>{rt(c.pools.note.body, v)}</Note>
      </Section>

      <Section id="announce" n={11} title={c.announce.title} labels={t.common}>
        {paragraphs(c.announce.body, v)}
        <Note tag={c.announce.note.tag}>{rt(c.announce.note.body, v)}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 10 */}
      <Section id="quiet" n={12} title={c.quiet.title} labels={t.common}>
        {paragraphs(c.quiet.body, v)}
        <Rows rows={rows(c.quiet.checks, v)} />
        <Note tag={c.quiet.note.tag}>{rt(c.quiet.note.body, v)}</Note>
      </Section>
    </GuideShell>
  );
}
