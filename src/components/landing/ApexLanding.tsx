import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import HeroShowcase from '@/components/landing/HeroShowcase';
import TileKinds, { TILE_KIND_COUNT } from '@/components/landing/TileKinds';
import FeatureGroups from '@/components/landing/FeatureGroups';
import Faq from '@/components/landing/Faq';
import ClanCrest from '@/components/ClanCrest';
import { FEATURE_PAGES, LANDING_FAQ } from '@/lib/answers';
import { EVENT_MODES } from '@/lib/eventModes';
import { PLANS } from '@/lib/plans';
import { heroCounts, type ShowcaseClan } from '@/lib/landingClansRules';
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
export default function ApexLanding({ stats, clans }: { stats: PlatformStats; clans: ShowcaseClan[] }) {
  const counts = heroCounts(stats);
  return (
    // The landing bleeds out of the shell's padding on purpose: it is the one page whose bands and
    // hero should touch the rail rather than sit in a column.
    <div className="-mx-4 -my-8 sm:-mx-6 lg:-mx-8">
      {/* The band bleeds; its CONTENTS sit in the same column as every section below. Letting the
          hero span an ultrawide monitor put a third of a metre of empty ground between the headline
          and the board, and the two stopped reading as one thought. */}
      <header className="forge-ground forge-heat relative overflow-hidden border-b border-card-border">
        {/* THE MARK, whole, behind the words. Cropping it off the corner left only the top slab and
            half the waist showing, which reads as a stray pale rectangle rather than an anvil — a
            silhouette has to be complete to be recognised at all. Hidden below `sm`, where there is
            no room for it to be anything but clutter. */}
        <AnvilMark
          size={620}
          className="pointer-events-none absolute -left-[60px] top-1/2 hidden -translate-y-1/2 text-gold/[0.035] sm:block xl:left-[2%]"
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
          <h1 className="display display-lg text-[clamp(2.1rem,5.5vw,3.7rem)] font-semibold leading-[1.04] [text-wrap:balance]">
            Every event you play,
            <br />
            <span className="bg-gradient-to-b from-gold-light to-gold bg-clip-text text-transparent">
              already counted
            </span>
            .
          </h1>
          <p className="mt-5 max-w-[48ch] text-[16.5px] leading-relaxed text-text-muted">
            Bingos, tile races, ladders and skill or boss weeks, with live standings on one page and
            Discord posts as it happens. The RuneLite plugin watches the game and fills the board in
            while you play.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ClanLink
              href="/clans"
              className="rounded-lg bg-gold px-5 py-3 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Find a clan
            </ClanLink>
            <ClanLink
              href="/clans/new"
              className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
            >
              Create your clan
            </ClanLink>
          </div>
          {/* The second audience: somebody with viewers or friends and no in-game clan. */}
          <p className="mt-3 text-[14px] text-text-muted">
            Streamer, or no clan?{' '}
            <ClanLink href="/host" className="font-medium text-gold hover:text-gold-light">
              Host an event for your viewers
            </ClanLink>
          </p>
          <p className="mt-3.5 text-[13px] text-text-dim">
            {/* The same model as the FAQ and /pricing, off the same PLANS row. */}
            Free for clans up to {PLANS.free.memberCap} members · bigger clans get a 30-day trial ·{' '}
            <ClanLink href="/pricing" className="text-gold hover:text-gold-light">
              Pricing
            </ClanLink>
          </p>
          {/* Real counts, each only once it is big enough to say. See lib/landingClansRules. */}
          {counts.length > 0 && (
            <p className="mt-2 font-mono text-[11.5px] text-text-dim">
              {counts.map((c) => `${c.n.toLocaleString()} ${c.label}`).join(' · ')}
            </p>
          )}
        </div>

        {/* Capped while stacked: given the whole 1180 column the board grows to a wall of sprites.
            A board wants to be about as wide as it is tall. */}
        <div className="relative w-full min-w-0 max-w-[620px] xl:max-w-none">
          <HeroShowcase />
          <p className="mt-2 text-center text-[11.5px] text-text-dim">
            A sample board, not a real clan. Every clan builds its own.
          </p>
        </div>
        </div>
      </header>

      {/* The molten rule: the boundary between the pitch and the platform under it. */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />

      {clans.length > 0 && (
        <div className="border-b border-card-border">
          <div className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">
                Clans playing this week
              </h2>
              <ClanLink href="/clans" className="text-[13px] font-medium text-gold hover:text-gold-light">
                See all clans →
              </ClanLink>
            </div>
            <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {clans.map((c) => (
                <li key={c.slug}>
                  <ClanLink
                    href={`/c/${c.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg px-3.5 py-3 transition-colors hover:border-gold-dark"
                  >
                    <ClanCrest slug={c.slug} name={c.name} logoUrl={c.logoUrl ?? null} size={36} rounded="rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{c.name}</span>
                      <span className="block truncate text-[12px] text-text-muted">
                        {c.activeThisWeek} played this week · {c.members} members
                      </span>
                    </span>
                    {c.recruiting && (
                      <span className="shrink-0 rounded-full border border-gold-dark px-2 py-0.5 text-[10.5px] text-gold">
                        Recruiting
                      </span>
                    )}
                  </ClanLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="border-b border-card-border">
        <div className="mx-auto grid max-w-[1180px] grid-cols-3">
          <Figure n={String(EVENT_MODES.length)} k="Event formats" />
          <Figure n={String(TILE_KIND_COUNT)} k="Things a tile can track" />
          {stats.xpThisWeek > 0 && <Figure n={compact(stats.xpThisWeek)} k="XP counted this week" />}
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-5 pb-20 sm:px-8">
        <Section
          title="If it happens in game, it counts."
          lede={`${TILE_KIND_COUNT} kinds of tile, all filled in by the plugin while you play. It takes the screenshot too, so nobody chases proof: no honour system, no spreadsheet.`}
        >
          <TileKinds />
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

        <FeatureGroups />

        {/* The plain-words half of the page. Everything above argues; this states — what it is,
            what it costs, what it needs — in sentences a search engine or an AI answer can quote
            whole. The FAQPage markup on this page (app/page.tsx) is these exact items. */}
        <Section
          title="Questions people ask."
          lede="What it is, what it costs, and what Anvil can and cannot see."
        >
          <Faq items={LANDING_FAQ} open={false} />
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
            {FEATURE_PAGES.map((p) => (
              <li key={p.slug}>
                <ClanLink href={`/features/${p.slug}`} className="text-gold hover:text-gold-light">
                  {p.h1}
                </ClanLink>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* The closing band, and the page's other bookend: the hero opens on the mark at the left, this
          closes on it at the right. Without it the band reserved the full column and filled half of
          it, so the page ended on a rectangle of nothing. */}
      <div className="forge-heat relative overflow-hidden border-t border-card-border py-14">
        {/* Whole, like the hero's. A cropped silhouette reads as a stray rectangle — the exact thing
            that had to be fixed up there, so it should not be reintroduced down here. */}
        <AnvilMark
          size={300}
          className="pointer-events-none absolute bottom-8 right-[7%] hidden text-gold/[0.05] lg:block"
        />
        {/* Padding INSIDE the max-width, as on every section above. Outside it, the band's content
            sat 48px left of every heading on the page — aligned to nothing at all. */}
        <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
          <h2 className="display display-lg max-w-[20ch] text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.06] [text-wrap:balance]">
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
              Create your clan
            </ClanLink>
            <ClanLink
              href="/guide/plugin"
              className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
            >
              Install the plugin
            </ClanLink>
            <ClanLink
              href="/guide/admin"
              className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
            >
              Read the admin guide
            </ClanLink>
          </div>
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
        <span className="molten h-[22px] w-1 shrink-0 rounded-sm" />
        <h2 className="display text-[clamp(1.35rem,2.6vw,1.7rem)] font-semibold leading-tight [text-wrap:balance]">
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
    <div className="border-r border-card-border px-5 py-5 last:border-r-0 sm:px-8">
      <div className="font-mono text-[clamp(1.4rem,2.6vw,1.9rem)] font-medium tabular-nums tracking-tight">
        {n}
      </div>
      <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.15em] text-text-muted">
        {k}
      </div>
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
