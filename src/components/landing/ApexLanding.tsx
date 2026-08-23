import ClanLink from '@/components/ClanLink';
import HeroShowcase from '@/components/landing/HeroShowcase';
import TileKinds, { TILE_KIND_COUNT } from '@/components/landing/TileKinds';
import { EVENT_MODES } from '@/lib/eventModes';
import { DISCORD_LOCALES } from '@/lib/discordI18n';
import type { PlatformStats } from '@/lib/platformStats';

/**
 * The apex, to someone who has not signed in.
 *
 * WHO IT ARGUES TO. The person who ORGANISES, because they are who signs a clan up — and their
 * problem is not that events are hard to play, it is that running one is two weeks of data entry
 * while everybody else enjoys the thing you built. That is the pitch, and it is why the section
 * below the fold is a comparison of somebody's fortnight rather than a feature list.
 *
 * WHAT IT SELLS. Not bingo. Anvil runs every format in `EVENT_MODES`, watches every kind of tile in
 * `TILE_KIND_BADGES`, keeps your collection log and personal bests current between events, and talks
 * to Discord in every locale the bot ships — and a landing that led with a bingo board sold about a
 * quarter of that. The claim
 * "everything your clan does" is the product; the sections below are each one piece of evidence
 * for it, in the order somebody deciding would want them.
 *
 * EVERY NUMBER ON THIS PAGE IS DERIVED. The formats count comes from `EVENT_MODES`, the tile kinds
 * from `TILE_KIND_BADGES`, the languages from the bot's own table, and the platform figures from
 * rows in the database. Nothing here is a marketing figure somebody has to remember to update, and
 * nothing can quietly become a lie.
 *
 * WHAT IT IS NOT. An earlier pass opened on a cross-clan feed of other clans' drops. Nobody browsing
 * has a reason to care: a stranger's drop in a clan you are not in is noise, and cross-clan interest
 * is real in only three moments — needing a clan, needing an opponent, playing one. Those are
 * utilities you visit on purpose, which is what /clans is for.
 */
export default function ApexLanding({ stats }: { stats: PlatformStats }) {
  return (
    // The landing bleeds out of the shell's padding on purpose: it is the one page whose bands and
    // hero should touch the rail rather than sit in a column.
    <div className="-mx-4 -my-8 sm:-mx-6 lg:-mx-8">
      {/* The band bleeds; its CONTENTS sit in the same column as every section below. Letting the
          hero span an ultrawide monitor put a third of a metre of empty ground between the headline
          and the board, and the two stopped reading as one thought. */}
      <header className="relative overflow-hidden border-b border-card-border">
        {/* Forge heat. The single decorative element on the page, and it sits behind the product
            rather than in front of the words. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-[10%] -top-[35%] h-[620px] w-[70%] opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at 45% 45%, rgba(212,160,23,0.14), rgba(212,160,23,0.03) 45%, transparent 70%)',
          }}
        />
        {/* Two columns at `xl`, not `lg`. The rail becomes the 240px sidebar at `lg`, so splitting
            the hero there too took both bites out of the same 1024px at once and left the board
            about 300px wide — tiles too small to read their own labels. Between 1024 and 1280 the
            hero stacks and gets the full column, which is the shape that reads best anyway. */}
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] xl:gap-12 xl:py-20">
        <div className="relative min-w-0">
          <div className="mb-5 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-gold-dark">
            For Old School RuneScape clans
            <span className="h-px w-12 bg-gradient-to-r from-gold-dark to-transparent" />
          </div>
          <h1 className="text-[clamp(2.1rem,5.5vw,3.6rem)] font-bold leading-[1.06] tracking-[-0.03em] [text-wrap:balance]">
            Everything your clan does,
            <br />
            <span className="text-gold">already counted</span>.
          </h1>
          <p className="mt-5 max-w-[48ch] text-[16.5px] leading-relaxed text-text-muted">
            Bingos, tile races, ladders, skill and boss weeks, clan against clan. Anvil holds the
            board and the roster; the RuneLite plugin watches the game and fills them in. Set it up
            once — then go play it like everybody else.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ClanLink
              href="/clans/new"
              className="rounded-lg bg-gold px-5 py-3 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Start your clan
            </ClanLink>
            <ClanLink
              href="/clans"
              className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
            >
              See a live event
            </ClanLink>
          </div>
          <p className="mt-3.5 text-[13px] text-text-dim">
            Free for one event · 30-day trial on everything else
          </p>
        </div>

        {/* Capped while stacked: given the whole 1180 column the board grows to a wall of sprites.
            A board wants to be about as wide as it is tall. */}
        <div className="relative w-full min-w-0 max-w-[620px] xl:max-w-none">
          <HeroShowcase />
        </div>
        </div>
      </header>

      {/* The molten rule: the boundary between the pitch and the platform under it. */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />

      <div className="border-b border-card-border">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 sm:grid-cols-4">
          <Figure n={String(EVENT_MODES.length)} k="Event formats" />
          <Figure n={String(TILE_KIND_COUNT)} k="Things a tile can track" />
          <Figure n={compact(stats.xpThisWeek)} k="XP counted this week" />
          <Figure n={String(DISCORD_LOCALES.length)} k="Bot languages" />
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-5 pb-20 sm:px-8">
        <Section
          title="If it happens in game, it counts."
          lede={`${TILE_KIND_COUNT} kinds of tile, all filled in by the plugin while you play. No screenshots to chase, no honour system, no spreadsheet.`}
        >
          <TileKinds />
        </Section>

        <Section
          title="And it remembers, between events."
          lede="The plugin syncs the parts of your account that events are built from, so a board can ask for a first Quiver rather than one more Colosseum."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Feature
              title="Collection log"
              body="Whole-log sync, per item, with rarity. Clan luck boards, spoons and droughts."
            />
            <Feature
              title="Personal bests"
              body="Every timed activity, imported from RuneLite and kept current."
            />
            <Feature
              title="Quests, diaries, CAs"
              body="Quest points, diary tiers, and combat achievement points and tier."
            />
            <Feature
              title="Moments"
              body="Pets, uniques and deaths captured as they happen — with a clip if you run OBS."
            />
          </div>
        </Section>

        <Section
          title="The person running the event never gets to play it."
          lede="Whatever the format, the organiser spends it doing data entry. Anyone who has run one recognises the left-hand column."
        >
          <div className="grid gap-px overflow-hidden rounded-2xl border border-card-border bg-card-border sm:grid-cols-2">
            <div className="bg-card-bg p-5 sm:p-6">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">
                The usual way
              </div>
              <ul className="m-0 list-none p-0">
                {[
                  'A spreadsheet only one person understands',
                  '200 screenshots in a thread, checked by hand',
                  '“Does this count?” — twice a day, for a fortnight',
                  'Somebody’s drop missed because they posted it at 3am',
                  'Recounting the totals the night it ends',
                  'Two weeks of your own event, spent on admin',
                ].map((t) => (
                  <li key={t} className="relative py-1.5 pl-5 text-[14px] leading-relaxed text-text-dim">
                    <span className="absolute left-0.5">×</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card-bg p-5 sm:p-6">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-gold-dark">
                With Anvil
              </div>
              <ul className="m-0 list-none p-0">
                {[
                  'One page everyone reads, always current',
                  'Drops, kills and levels submit themselves',
                  'Rules decided once, when you build the thing',
                  'Nothing missed — the plugin was watching',
                  'Standings settled the moment it ends',
                  'You play in it, like everybody else',
                ].map((t) => (
                  <li key={t} className="relative py-1.5 pl-5 text-[14px] leading-relaxed">
                    <span className="absolute left-0 text-xs text-accent-green-light">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section
          title="Where your clan already talks."
          lede={`The bot posts drops, deaths, standings and winners into the channels you choose — and answers questions in ${DISCORD_LOCALES.length} languages.`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Feature
              title="/bingo board"
              body="The live board, in chat, without anybody leaving Discord."
            />
            <Feature
              title="Roles and nicknames"
              body="Synced from the roster, so your server matches the game."
            />
            <Feature
              title="Per-channel routing"
              body="Rare drops, deaths, clips and standings each to their own home."
            />
            <Feature
              title="Private team channels"
              body="Built when the draft lands and torn down when the event ends."
            />
          </div>
        </Section>

        <Section
          title="And when you want a rival."
          lede="The one thing you cannot do alone — and the reason every clan sits on one platform rather than one site each."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Feature
              title="Play another clan"
              body="Post an open challenge, or invite a clan you already know. Both rosters play one board. Their players get a seat for the event and nothing more — no joining, no Discord swap, no shared spreadsheet."
            />
            <Feature
              title="Or find people"
              body="Clans looking for members, players looking for clans. Applications arrive in the same queue as everything else, with the person’s account and stats already attached."
            />
          </div>
        </Section>
      </div>

      <div className="border-t border-card-border bg-gradient-to-b from-gold/[0.05] to-transparent px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="max-w-[20ch] text-[clamp(1.7rem,3.4vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.025em] [text-wrap:balance]">
            Your next event could run without you.
          </h2>
          <p className="mt-3.5 max-w-[54ch] text-[15.5px] leading-relaxed text-text-muted">
            Set the clan up in an evening. The plugin is on the RuneLite hub, and your members install
            it once for every clan they will ever be in. Then it is somebody else’s turn to wonder how
            you find the time.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ClanLink
              href="/clans/new"
              className="rounded-lg bg-gold px-5 py-3 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Start your clan
            </ClanLink>
            <ClanLink
              href="/guide/admin"
              className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
            >
              Read the admin guide
            </ClanLink>
          </div>
          {stats.clans > 0 && (
            <p className="mt-7 font-mono text-[11.5px] text-text-dim">
              {stats.clans.toLocaleString()} clans · {stats.members.toLocaleString()} members ·{' '}
              {stats.eventsRun.toLocaleString()} events run
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-14 sm:pt-16">
      <div className="mb-2.5 flex items-center gap-3">
        <span className="h-[22px] w-1 shrink-0 rounded-sm bg-gold" />
        <h2 className="text-[clamp(1.3rem,2.6vw,1.6rem)] font-semibold leading-tight tracking-[-0.02em] [text-wrap:balance]">
          {title}
        </h2>
      </div>
      <p className="mb-5 ml-4 max-w-[62ch] text-[14.5px] leading-relaxed text-text-muted">{lede}</p>
      {children}
    </section>
  );
}

function Figure({ n, k }: { n: string; k: string }) {
  return (
    // Its own padding, matching the sections' — so the band's numbers sit on the same left edge as
    // every heading below it.
    //
    // The dividers go BETWEEN cells and the grid rewraps, so which cell ends a row changes with the
    // breakpoint: two columns want a divider after 1 and 3, four columns after 1, 2 and 3. Restoring
    // it at `sm` for every even cell put one back after the fourth, hanging off the end of the band.
    <div className="border-b border-r border-card-border px-5 py-5 sm:border-b-0 sm:px-8 [&:nth-child(2n)]:border-r-0 [&:nth-child(n+3)]:border-b-0 sm:[&:nth-child(2)]:border-r">
      <div className="font-mono text-[clamp(1.4rem,2.6vw,1.9rem)] font-medium tabular-nums tracking-tight">
        {n}
      </div>
      <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.15em] text-text-muted">
        {k}
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
      <b className="mb-1.5 block text-[14.5px] font-semibold">{title}</b>
      <span className="block text-[13.5px] leading-relaxed text-text-muted">{body}</span>
    </div>
  );
}

/** 90,167,827 → "90.2M". Real figures, shortened — not rounded up. */
function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
