import Link from 'next/link';

export interface DirectoryClan {
  slug: string;
  name: string;
  host: string;
  members: number;
  events: number;
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
          <Link
            key={c.slug}
            href={`/c/${c.slug}`}
            className="block border border-card-border rounded-xl bg-card-bg p-5 hover:border-gold/40 transition-colors"
          >
            <h2 className="text-lg font-semibold text-foreground mb-1">{c.name}</h2>
            <p className="text-xs text-text-muted font-mono mb-4">{c.host}</p>
            <div className="flex gap-6 text-sm">
              <span className="text-text-muted">
                <span className="text-gold font-semibold">{c.members}</span> member{c.members === 1 ? '' : 's'}
              </span>
              <span className="text-text-muted">
                <span className="text-gold font-semibold">{c.events}</span> event{c.events === 1 ? '' : 's'}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-sm text-text-muted mt-10">
        Each clan runs at its own address, with its own roster, boards and settings.{' '}
        <Link href="/guide" className="text-gold hover:text-gold-light">
          What Anvil does
        </Link>
      </p>
    </div>
  );
}
