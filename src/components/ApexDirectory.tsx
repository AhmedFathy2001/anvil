
import ClanLink from '@/components/ClanLink';
export interface DirectoryClan {
  slug: string;
  name: string;
  host: string;
  members: number;
  events: number;
  /** In-game name proven, so this is the clan it says it is. */
  verified: boolean;
  /** 'approval' | 'open' | 'closed' — whether a stranger can ask to join at all. */
  guestPolicy: string;
  /** Members who gained anything in seven days. A clan's pulse, not its size. */
  activeThisWeek: number;
  xpThisWeek: number;
}

/**
 * The apex landing: every clan on the platform.
 *
 * This is the surface that only exists because clans are rows now. Under one clan per deployment
 * there was nothing an apex COULD show — each site knew only itself. It is deliberately built from
 * the same aggregates the clan pages use rather than a curated list, so a clan appears here by
 * existing, not by being added to something.
 */
export default function ApexDirectory({ clans }: { clans: DirectoryClan[] }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-1 h-8 bg-gold rounded-full" />
          <h1 className="text-3xl font-bold text-gold">Clans on Anvil</h1>
        </div>
        <p className="text-text-muted">
          {clans.length === 0
            ? 'No clans yet.'
            : `${clans.length} clan${clans.length === 1 ? '' : 's'} running bingos, weekly competitions and rosters.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Stays on the apex: clicking a clan should not move you to another hostname before you
            have decided you want that clan. /c/<slug> is the same browse, and links across once
            you do. */}
        {clans.map((c) => (
          <ClanLink
            key={c.slug}
            href={`/c/${c.slug}`}
            className="block border border-card-border rounded-xl bg-card-bg p-5 hover:border-gold/40 transition-colors"
          >
            {/* The hostname used to sit here in monospace, which told the reader these were three
                separate sites and that opening one meant leaving. They are one site; the address is
                /c/<slug> and nobody needs to read it off a card. */}
            <h2 className="text-lg font-semibold text-foreground mb-4">{c.name}</h2>
            <div className="flex gap-6 text-sm">
              <span className="text-text-muted">
                <span className="text-gold font-semibold">{c.members}</span> member{c.members === 1 ? '' : 's'}
              </span>
              <span className="text-text-muted">
                <span className="text-gold font-semibold">{c.events}</span> event{c.events === 1 ? '' : 's'}
              </span>
            </div>
          </ClanLink>
        ))}
      </div>

      {/* This line used to read "Each clan keeps its own roster, boards and settings" — true, and
          exactly the wrong thing to lead with on the page whose job is to show they share a home.
          What a visitor needs to know is that they can be in more than one, not that the walls are
          solid. */}
      <p className="text-sm text-text-muted mt-10">
        You can be in more than one &mdash; your account, characters and history follow you between
        them.{' '}
        <ClanLink href="/leaderboard" className="text-gold hover:text-gold-light">
          See how they compare
        </ClanLink>
        {' · '}
        <ClanLink href="/guide" className="text-gold hover:text-gold-light">
          What Anvil does
        </ClanLink>
      </p>
    </div>
  );
}
