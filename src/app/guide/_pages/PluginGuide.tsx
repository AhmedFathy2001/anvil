import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { db } from '@/db';
import { settings, accounts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getOAuthMode } from '@/lib/discord-oauth';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { currentClan } from '@/lib/clanContext';
import { Chat, Figure, GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict } from '../_i18n';
import { chat, items, legend, paragraphs, rows, rt } from '../_i18n/rich';

/**
 * Canonical origin for the "paste this into Site URL" instruction. Same resolution order as
 * lib/request-origin (env first — Host is attacker-controllable), with a Host fallback that's
 * acceptable here because the value is only ever *displayed*, never redirected to. Local dev has
 * neither, so it degrades to the placeholder.
 */
async function siteOrigin(): Promise<string> {
  const fromEnv = (u: string | undefined): string | null => {
    if (!u) return null;
    try {
      return new URL(u).origin;
    } catch {
      return null;
    }
  };
  const configured = fromEnv(process.env.APP_URL) || fromEnv(process.env.DISCORD_REDIRECT_URI);
  if (configured) return configured;
  const h = await headers();
  const host = h.get('host');
  return host ? `https://${host}` : 'https://your-clan.example.com';
}

export async function pluginGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.plugin.metaTitle, description: t.plugin.metaDescription };
}

export default async function PluginGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const p = t.plugin;
  const { locale, languages, notice } = localeChrome(lang, 'plugin', t.common);

  const origin = await siteOrigin();
  const clan = await currentClan();
  const clanName = clan ? await getClanDisplayName(clan.id, 'this clan') : 'your clan';
  const inviteRow = clan
    ? await db.query.settings.findFirst({
        where: and(eq(settings.clanId, clan.id), eq(settings.key, 'discord_invite_url')),
      })
    : null;
  const discordInvite = inviteRow?.value?.trim() || process.env.DISCORD_INVITE_URL?.trim() || null;

  // Which login this instance uses decides one paragraph in step 2: a managed instance authenticates
  // Discord through the shared Anvil login (a visible hop to another domain, worth explaining before
  // someone thinks it's a phishing redirect); a BYO-app instance never leaves this site. 'none' means
  // Discord login isn't configured at all, so the in-plugin sign-in can't work — token only.
  const oauthMode = getOAuthMode();
  // Federation was removed — clans live in one app now. The flag stays so the paragraphs
  // that mention it stop rendering without ripping the strings out of fifteen locales.
  const federationEnabled = false;

  const v = { origin, clanName };

  const discordLink = discordInvite ? (
    <a href={discordInvite} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light">
      {p.working.guestNote.discordWord}
    </a>
  ) : (
    p.working.guestNote.discordWord
  );

  const SECTIONS = [
    { id: 'install', n: 1, title: p.install.title },
    { id: 'connect', n: 2, title: p.connect.title },
    { id: 'accounts', n: 3, title: p.accounts.title },
    { id: 'working', n: 4, title: p.working.title },
    { id: 'bingo', n: 5, title: p.bingo.title },
    { id: 'notifications', n: 6, title: p.notifications.title },
    { id: 'clips', n: 7, title: p.clips.title },
    { id: 'trouble', n: 8, title: p.trouble.title },
  ];

  return (
    <GuideShell
      eyebrow={p.eyebrow}
      title={p.title}
      sections={SECTIONS}
      minutes={7}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(p.dek, v)}
      facts={p.facts}
      footnote={rt(p.footnote, v)}
    >
      {/* ---------------------------------------------------------------- 1 */}
      <Section id="install" n={1} title={p.install.title} labels={t.common}>
        {paragraphs(p.install.body, v)}
      </Section>

      {/* ---------------------------------------------------------------- 2 */}
      <Section id="connect" n={2} title={p.connect.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.connect.intro, v)}</p>

        <Figure
          src="/guide/plugin-setup.png"
          width={534}
          height={330}
          alt={p.connect.figure.alt}
          caption={p.connect.figure.caption}
          legend={legend(p.connect.figure.legend, v)}
        />

        {oauthMode !== 'none' && (
          <>
            <h3 className="text-lg font-semibold pt-2">{p.connect.easyHeading}</h3>
            <p className="text-text-muted">{rt(p.connect.easyIntro, v)}</p>
            <ol className="list-decimal pl-5 text-text-muted space-y-1.5 text-sm">
              {items(p.connect.easySteps, v)}
            </ol>

            <Figure
              src="/guide/site-link-device.png"
              width={555}
              height={370}
              alt={p.connect.linkFigure.alt}
              caption={p.connect.linkFigure.caption}
              legend={legend(p.connect.linkFigure.legend, v)}
            />

            {/* Instance-specific: where the browser actually goes to authenticate you. */}
            {false ? (
              <Note tag={p.connect.brokeredNote.tag}>{paragraphs(p.connect.brokeredNote.body, v, '')}</Note>
            ) : (
              <Note tag={p.connect.directNote.tag}>{paragraphs(p.connect.directNote.body, v, '')}</Note>
            )}

            {federationEnabled && (
              <p className="text-sm text-text-muted">{rt(p.connect.federationAside, v)}</p>
            )}

            <p className="text-text-muted text-sm">{rt(p.connect.manualFallback, v)}</p>

            <h3 className="text-lg font-semibold pt-2">{p.connect.manualHeading}</h3>
          </>
        )}

        <p className="text-text-muted">{rt(p.connect.manualIntro, v)}</p>

        <Figure
          src="/guide/site-token.png"
          width={896}
          height={279}
          alt={p.connect.tokenFigure.alt}
          caption={p.connect.tokenFigure.caption}
          legend={legend(p.connect.tokenFigure.legend, v)}
        />

        <Note tag={p.connect.goodToKnow.tag}>{paragraphs(p.connect.goodToKnow.body, v, '')}</Note>
      </Section>

      {/* ---------------------------------------------------------------- 3 */}
      <Section id="accounts" n={3} title={p.accounts.title} labels={t.common}>
        {paragraphs(p.accounts.body, v)}

        <Figure
          src="/guide/site-accounts.png"
          width={835}
          height={290}
          alt={p.accounts.figure.alt}
          caption={p.accounts.figure.caption}
          legend={legend(p.accounts.figure.legend, v)}
        />

        <h3 className="text-lg font-semibold pt-2">{p.accounts.noPluginHeading}</h3>
        <p className="text-text-muted">{rt(p.accounts.noPluginIntro, v)}</p>
        <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">
          {items(p.accounts.noPluginOptions, v)}
        </ul>
        <p className="text-text-muted text-sm">{rt(p.accounts.signupNote, v)}</p>
      </Section>

      {/* ---------------------------------------------------------------- 4 */}
      <Section id="working" n={4} title={p.working.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.working.intro, v)}</p>
        <Chat lines={chat(p.working.chat)} />
        <p className="text-text-muted">{rt(p.working.outro, v)}</p>
        <Note tag={p.working.guestNote.tag}>
          <p>{rt(p.working.guestNote.body, { ...v, discordLink })}</p>
        </Note>
      </Section>

      {/* ---------------------------------------------------------------- 5 */}
      <Section id="bingo" n={5} title={p.bingo.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.bingo.intro, v)}</p>
        <Figure
          src="/guide/plugin-bingo.png"
          width={534}
          height={494}
          alt={p.bingo.figure.alt}
          caption={p.bingo.figure.caption}
          legend={legend(p.bingo.figure.legend, v)}
        />

        <h3 className="text-foreground font-medium mt-6">{p.bingo.startHeading}</h3>
        {paragraphs(p.bingo.startBody, v)}
      </Section>

      {/* ---------------------------------------------------------------- 6 */}
      <Section id="notifications" n={6} title={p.notifications.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.notifications.intro, v)}</p>

        <Figure
          src="/guide/plugin-notify-drops.png"
          width={534}
          height={772}
          alt={p.notifications.dropsFigure.alt}
          caption={p.notifications.dropsFigure.caption}
          legend={legend(p.notifications.dropsFigure.legend, v)}
        />

        <Figure
          src="/guide/plugin-notify-ca.png"
          width={534}
          height={364}
          alt={p.notifications.caFigure.alt}
          caption={p.notifications.caFigure.caption}
          legend={legend(p.notifications.caFigure.legend, v)}
        />
      </Section>

      {/* ---------------------------------------------------------------- 7 */}
      <Section id="clips" n={7} title={p.clips.title} optional labels={t.common}>
        {paragraphs(p.clips.intro, v)}

        <Note tag={p.clips.privacyNote.tag}>
          <p>{rt(p.clips.privacyNote.body, v)}</p>
        </Note>

        <h3 className="text-lg font-semibold pt-2">{p.clips.obsHeading}</h3>
        <ol className="list-decimal pl-5 text-text-muted space-y-2 text-sm">{items(p.clips.obsSteps, v)}</ol>
        <p className="text-text-muted text-sm">{rt(p.clips.obsAside, v)}</p>

        <h3 className="text-lg font-semibold pt-2">{p.clips.fillHeading}</h3>
        <Figure
          src="/guide/plugin-clips.png"
          width={522}
          height={884}
          alt={p.clips.figure.alt}
          caption={p.clips.figure.caption}
          legend={legend(p.clips.figure.legend, v)}
        />

        <h3 className="text-lg font-semibold pt-2">{p.clips.useHeading}</h3>
        <p className="text-text-muted">{rt(p.clips.useIntro, v)}</p>
        <Chat lines={chat(p.clips.useChat)} />
        <Note tag={p.clips.reminder.tag} tone="green">
          <p>{rt(p.clips.reminder.body, v)}</p>
        </Note>

        <h3 className="text-lg font-semibold pt-2">{p.clips.decodedHeading}</h3>
        <Rows rows={rows(p.clips.decoded, v)} />
      </Section>

      {/* ---------------------------------------------------------------- 8 */}
      <Section id="trouble" n={8} title={p.trouble.title} labels={t.common}>
        <p className="text-text-muted">{rt(p.trouble.intro, v)}</p>
        <Rows rows={rows(p.trouble.rows, v)} />

        <h3 className="text-lg font-semibold pt-2">{p.trouble.logHeading}</h3>
        <p className="text-text-muted">{rt(p.trouble.logBody, v)}</p>
        <Note tag={p.trouble.missingNote.tag}>
          <p>{rt(p.trouble.missingNote.body, v)}</p>
        </Note>
      </Section>
    </GuideShell>
  );
}
