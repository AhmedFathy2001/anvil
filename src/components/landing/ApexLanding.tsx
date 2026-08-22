import ClanLink from '@/components/ClanLink';
import HeroShowcase from '@/components/landing/HeroShowcase';
import type { PlatformStats } from '@/lib/platformStats';

/**
 * The apex, to someone who has not signed in.
 *
 * WHO IT ARGUES TO. The person who ORGANISES, because they are who signs a clan up — and their
 * problem is not that events are hard to play, it is that running one is two weeks of data entry
 * while everybody else enjoys the thing you built. That is the pitch, and it is why the section
 * below the fold is a comparison of somebody's fortnight rather than a feature list.
 *
 * WHAT IT IS NOT. An earlier pass opened on a cross-clan feed of other clans' drops. Nobody browsing
 * has a reason to care: a stranger's drop in a clan you are not in is noise, and cross-clan interest
 * is real in only three moments — needing a clan, needing an opponent, playing one. Those are
 * utilities you visit on purpose, which is what /clans is for.
 */
export default function ApexLanding({ stats }: { stats: PlatformStats }) {
  return (
    <div>
      <header className="relative grid items-center gap-8 overflow-hidden border-b border-card-border px-5 py-16 sm:px-10 lg:grid-cols-[minmax(320px,1fr)_minmax(300px,520px)] lg:gap-14 lg:py-20">
        {/* Forge heat. The single decorative element on the page, and it sits behind the product
            rather than in front of the words. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-[10%] -top-[30%] h-[560px] w-[80%] opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at 45% 45%, rgba(212,160,23,0.14), rgba(212,160,23,0.03) 45%, transparent 70%)',
          }}
        />
        <div className="relative">
          <div className="mb-5 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-gold-dark">
            For Old School RuneScape clans
            <span className="h-px w-12 bg-gradient-to-r from-gold-dark to-transparent" />
          </div>
          <h1 className="text-[clamp(2.4rem,5vw,3.9rem)] font-bold leading-[1.06] tracking-[-0.03em]">
            Set it up once.
            <br />
            Then go <span className="text-gold">play</span>.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-text-muted">
            Bingos, tile races, skill and boss weeks, clan against clan. Anvil holds the board, the
            roster and the standings — and the RuneLite plugin keeps them current while your clan
            plays. Including you, for once.
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
          <p className="mt-3.5 text-[13px] text-text-muted/70">
            Free for one event · 30-day trial on everything else
          </p>
        </div>

        <div className="relative">
          <HeroShowcase />
        </div>
      </header>

      {/* The molten rule: the boundary between the pitch and the platform under it. */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />

      {stats.clans > 0 && (
        <div className="grid grid-cols-2 border-b border-card-border sm:grid-cols-4">
          <Figure n={stats.clans.toLocaleString()} k="Clans" />
          <Figure n={stats.members.toLocaleString()} k="Members" />
          <Figure n={stats.eventsRun.toLocaleString()} k="Events run" />
          <Figure n={compactXp(stats.xpThisWeek)} k="XP this week" />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-10">
        <section className="pt-16">
          <SectionHead title="The person running the event never gets to play it." />
          <p className="mb-6 ml-4 max-w-[58ch] text-[15px] text-text-muted">
            Whatever the format, the organiser spends it doing data entry. Anyone who has run one
            recognises the left-hand column.
          </p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-card-border bg-card-border sm:grid-cols-2">
            <div className="bg-card-bg p-6">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted/70">
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
                  <li key={t} className="relative py-1.5 pl-5 text-[14.5px] text-text-muted/80">
                    <span className="absolute left-0.5 text-text-muted/60">×</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card-bg p-6">
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
                  <li key={t} className="relative py-1.5 pl-5 text-[14.5px]">
                    <span className="absolute left-0 text-xs text-accent-green-light">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="pt-16">
          <SectionHead title="What you get" />
          <p className="mb-6 ml-4 text-[15px] text-text-muted">
            Built for the person organising, not the person browsing.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              tag="Formats"
              title="Seven of them, one builder"
              body="Bingo, tile race, ladder, leagues, skill week, boss week, clan against clan. Same roster, same rules engine, same page — you pick the shape and the rest is already wired."
            />
            <Feature
              tag="The roster"
              title="One button, not a sign-up sheet"
              body="Sync the in-game clan and everyone appears, ranks included. Discord roles and nicknames follow. Members link their own alts; you approve or ignore."
            />
            <Feature
              tag="Every week"
              title="Something on, always"
              body="Skill and boss weeks run themselves on a schedule — baselines taken, standings posted to Discord, winners announced. The gap between events stops being dead air."
            />
          </div>
        </section>

        <section className="pt-16">
          <SectionHead title="And when you want a rival" />
          <p className="mb-6 ml-4 text-[15px] text-text-muted">The one thing you cannot do alone.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feature
              title="Play another clan"
              body="Post an open challenge, or invite a clan you already know. Both rosters play one board. Their players get a seat for the event and nothing more — no joining, no Discord swap, no shared spreadsheet."
            />
            <Feature
              title="Or find people"
              body="Clans looking for members, players looking for clans. Applications arrive in the same queue as everything else, with the person’s account and stats already attached."
            />
          </div>
        </section>
      </div>

      <div className="border-t border-card-border bg-gradient-to-b from-gold/[0.05] to-transparent px-5 py-14 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-[20ch] text-[clamp(1.8rem,3.4vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.025em]">
            Your next event could run without you.
          </h2>
          <p className="mt-3.5 max-w-[52ch] text-[16px] text-text-muted">
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
        </div>
      </div>
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="h-[22px] w-1 shrink-0 rounded-sm bg-gold" />
      <h2 className="text-[27px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
    </div>
  );
}

function Figure({ n, k }: { n: string; k: string }) {
  return (
    <div className="border-r border-card-border px-5 py-5 last:border-r-0 sm:px-8">
      <div className="font-mono text-[clamp(1.4rem,2.6vw,1.9rem)] font-medium tabular-nums tracking-tight">
        {n}
      </div>
      <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.15em] text-text-muted">{k}</div>
    </div>
  );
}

function Feature({ tag, title, body }: { tag?: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-6">
      {tag && (
        <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-gold-dark">
          {tag}
        </span>
      )}
      <h3 className="mb-2 text-[17.5px] font-semibold">{title}</h3>
      <p className="text-[14.5px] leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}

/** 90,167,827 → "90.2M". Real figures, shortened — not rounded up. */
function compactXp(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
