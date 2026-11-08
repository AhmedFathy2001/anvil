import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isApexHost } from '@/lib/clanContext';
import { EVENT_MODES } from '@/lib/eventModes';
import { TILE_KIND_COUNT } from '@/components/landing/TileKinds';
import { DISCORD_LOCALES } from '@/lib/discordI18n';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About — Anvil',
  description:
    'What Anvil is: a website, a RuneLite plugin and a Discord bot that run Old School RuneScape clan events and competitions. Who it is for and how it works.',
  openGraph: {
    title: 'About Anvil',
    description:
      'A website, a RuneLite plugin and a Discord bot for Old School RuneScape clan events. For clan owners, players and streamers.',
  },
};

/**
 * /about — apex only.
 *
 * The counters are derived, like the landing's, so nothing here can quietly become a lie: formats
 * from EVENT_MODES, tile kinds from the badge set, languages from the bot's own table.
 */
export default async function AboutPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const formats = EVENT_MODES.length;
  const languages = DISCORD_LOCALES.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="relative mb-10 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.05] sm:block"
        />
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">About</p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold [text-wrap:balance]">
          Your clan&rsquo;s events, without the fortnight of data entry.
        </h1>
        <p className="relative mt-3 max-w-[58ch] text-[16px] leading-relaxed text-text-muted">
          Anvil holds the board and the roster; the RuneLite plugin watches the game and fills them
          in. You set it up once — then go play it like everybody else.
        </p>
      </header>

      <div className="mb-12 grid grid-cols-3 overflow-hidden rounded-2xl border border-card-border">
        <Stat n={formats} label="Event formats" />
        <Stat n={TILE_KIND_COUNT} label="Things a tile can track" bordered />
        <Stat n={languages} label="Discord languages" />
      </div>

      <div className="flex flex-col gap-9">
        <Section title="What it is">
          Anvil is a home for Old School RuneScape clan events. Bingos, tile races, ladders, Skill and
          Boss of the Week and clan-versus-clan competitions all run on the same platform, and the
          same plugin that credits a bingo drop also tracks a boss kill count, a level, a collection
          log slot or a PvP kill.
        </Section>

        <Section title="Who it is for">
          <ul className="m-0 list-none space-y-2 p-0">
            <li>
              <b className="text-text">Clan owners and staff.</b> Run events without the spreadsheets,
              keep the roster in step with the game, and manage the coffer, prizes and clan events.
            </li>
            <li>
              <b className="text-text">Players.</b> Install one plugin, play, and get credit for what
              you do. Your profile, collection log and personal bests follow you into every clan.
            </li>
            <li>
              <b className="text-text">Streamers and creators.</b> Host events for your viewers with no
              in-game clan needed, with a page of your own for your community.
            </li>
          </ul>
        </Section>

        <Section title="How it works">
          Three parts work together. The <b className="text-text">website</b> holds the boards, rosters,
          competitions and clan pages. The <b className="text-text">RuneLite plugin</b> watches the
          game, credits the right player with a screenshot as proof, and puts your team in a side
          panel with a feed, chat, lookup and a &ldquo;Do this next&rdquo; card. The{' '}
          <b className="text-text">Discord bot</b> posts the highlights to the channels you choose and
          can set those channels up for you.
        </Section>

        <Section title="What you can do">
          Run eight event formats, including Tile race with branching roads, Showdown and Lucky draw.
          Spring missions mid-event, co-host with other clans, and run clan-versus-clan competitions.
          Check tile balance from real drop rates and kill speeds, see who is spooned or dry, and
          review flagged proof. Every setup guide comes in 16 languages.
        </Section>

        <Section title="What we believe">
          Rules are decided once, when you build the event, and the game does the counting. Nobody
          should lose a drop because they posted it at 3am. The organiser should get to play too.
          One account follows a player across every clan, so a guest in your event brings their own
          history, and their proof is theirs everywhere.
        </Section>

        <Section title="Where it runs">
          Every clan gets its own space at <code className="text-gold">/c/your-clan</code>, with its own
          roster, boards and Discord, all on one platform so people move between clans without
          re-linking anything. Bring your own domain on the top tier.
        </Section>

        <Section title="Read more">
          <span className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              ['/guide', 'All guides'],
              ['/guide/plugin', 'Install the plugin'],
              ['/guide/side-panel', 'Side panel'],
              ['/guide/team-competitions', 'Team competitions'],
              ['/guide/discord', 'Discord'],
              ['/guide/admin', 'Admin guide'],
              ['/legal/terms', 'Terms'],
              ['/legal/privacy', 'Privacy'],
              ['/legal/refunds', 'Refunds'],
            ].map(([href, label]) => (
              <ClanLink key={href} href={href} className="text-gold hover:text-gold-light">
                {label}
              </ClanLink>
            ))}
          </span>
        </Section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <ClanLink
          href="/clans/new"
          className="rounded-lg bg-gold px-5 py-3 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Create your clan
        </ClanLink>
        <ClanLink
          href="/guide/plugin"
          className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
        >
          Install the plugin
        </ClanLink>
        <ClanLink
          href="/clans"
          className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
        >
          Browse clans
        </ClanLink>
        <ClanLink
          href="/pricing"
          className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
        >
          See pricing
        </ClanLink>
        <ClanLink
          href="/welcome"
          className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
        >
          Set up your player account
        </ClanLink>
      </div>
    </div>
  );
}

function Stat({ n, label, bordered }: { n: number; label: string; bordered?: boolean }) {
  return (
    <div className={`px-4 py-5 text-center ${bordered ? 'border-x border-card-border' : ''}`}>
      <div className="font-mono text-[clamp(1.4rem,3vw,1.9rem)] font-medium tabular-nums tracking-tight">
        {n}
      </div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[17px] font-semibold">{title}</h2>
      </div>
      <div className="ml-4 max-w-[64ch] text-[14.5px] leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}
