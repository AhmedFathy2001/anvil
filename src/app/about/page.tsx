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
  description: 'What Anvil is, who it is for, and how it runs your clan’s events without running you.',
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
          A platform for running RuneScape clan events — bingos, tile races, ladders, skill and boss
          weeks, clan against clan. It is not a bingo tool that grew a few extras: every format is a
          first-class citizen, and the same plugin that tracks a bingo drop tracks a boss KC, an
          agility lap, a collection-log unlock or a PvP kill.
        </Section>

        <Section title="Who it is for">
          The person who <em>organises</em>. Running an event by hand is spreadsheets, screenshots and
          chasing people for proof while everyone else enjoys the thing you built. Anvil does the
          collecting so the organiser gets to play too — and the members just install one plugin and
          forget it exists.
        </Section>

        <Section title="How it works">
          Members link their RuneScape account once and install the Anvil plugin from the RuneLite
          hub. From then on it reports drops, kills, XP and personal bests to whichever of your clan&rsquo;s
          boards are live, credits the right person automatically, and posts the highlights to Discord.
          One account follows a person across every clan they ever join — so a guest in your event
          brings their own history, and their proof is theirs everywhere.
        </Section>

        <Section title="Where it runs">
          Every clan gets its own space at <code className="text-gold">/c/your-clan</code>, its own
          roster, its own boards and its own Discord — all on one platform, so people move between
          clans without leaving the app or re-linking anything. Bring your own domain on the top tier.
        </Section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <ClanLink
          href="/clans/new"
          className="rounded-lg bg-gold px-5 py-3 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Start your clan
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
      <p className="ml-4 max-w-[64ch] text-[14.5px] leading-relaxed text-text-muted">{children}</p>
    </section>
  );
}
