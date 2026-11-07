import { headers } from 'next/headers';

import ClanLink from '@/components/ClanLink';
import PlatformDiscordStrip from '@/components/PlatformDiscordStrip';
import { APP_VERSION, GIT_SHA } from '@/lib/serverInfo';
import { currentClan, isApexHost } from '@/lib/clanContext';
import { SITE } from '@/lib/site';

/**
 * The footer, and the licence's attribution.
 *
 * A COMPONENT BECAUSE IT HAS TWO HOMES. A clan page is one column under a top nav, so the footer
 * spans the window. The apex is a rail beside a column, and the footer belongs in the COLUMN —
 * rendered as a sibling of the whole row it ran underneath the rail, starting at x=0 while every
 * other thing on the page started at 240, and centred its own text on the window rather than on the
 * content beside it. The bottom of the page looked like it had come apart, because it had.
 *
 * GROUPED, NOT ONE ROW. Eleven links in a single flat run read as clutter, so they sit in short
 * labelled columns beside the wordmark: what Anvil is, where to get help, and the legal pages.
 *
 * AUTHOR ATTRIBUTION — required by LICENSE (PolyForm Noncommercial 1.0.0 + Attribution). The
 * "Built by Ahmed Fathy" credit and its link must remain visible in any deployment or derivative
 * work. There is no donation-link carve-out: nothing in this block is optional.
 */

type FooterLink = { href: string; label: string; apexOnly?: boolean; highlight?: boolean };

// About, Features, Events, Pricing and Billing are apex-only pages (they 404 on a clan host by
// design), so they are linked only where they resolve. /guide, /feedback, /supporter and /legal are
// instance-aware and work on every host. `/events` here is the apex's public events directory.
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/about', label: 'About', apexOnly: true },
      { href: '/features', label: 'Features', apexOnly: true },
      { href: '/events', label: 'Events', apexOnly: true },
      { href: '/pricing', label: 'Pricing', apexOnly: true },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '/supporter', label: 'Support Anvil', highlight: true },
      { href: '/guide', label: 'Guides' },
      { href: '/feedback', label: 'Feedback & bug reports' },
      { href: '/portal', label: 'Billing', apexOnly: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/refunds', label: 'Refunds' },
    ],
  },
];

export default async function SiteFooter() {
  const onApex = isApexHost((await headers()).get('host'));
  // Anvil's own Discord belongs on the platform's pages, not under a clan's: `/c/<slug>` is served
  // from the apex host too, and there the clan's own card is the Discord that matters.
  const platformPage = onApex && !(await currentClan());

  const columns = COLUMNS.map((c) => ({ ...c, links: c.links.filter((l) => onApex || !l.apexOnly) })).filter(
    (c) => c.links.length > 0,
  );

  return (
    <footer className="mt-16 border-t border-card-border text-text-muted">
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-6 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          {/* Who this is, and — on the platform's own pages — who is around to help right now. */}
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-48.png" alt="" width={22} height={22} className="shrink-0 rounded-md" />
                <span className="display text-[16px] font-semibold text-gold">Anvil</span>
              </div>
              <p className="max-w-sm text-[13px] leading-relaxed text-text-muted/80">{SITE.tagline}</p>
            </div>
            {platformPage && <PlatformDiscordStrip />}
          </div>

          {/* Columns step 1 → 2 → as many as there are, so nothing ever squeezes sideways. */}
          <nav
            aria-label="Footer"
            className={`grid grid-cols-1 gap-x-6 gap-y-8 min-[420px]:grid-cols-2 ${
              columns.length >= 3 ? 'sm:grid-cols-3' : ''
            }`}
          >
            {columns.map((col) => (
              <div key={col.title} className="min-w-0">
                <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">
                  <span className="h-3 w-[3px] shrink-0 rounded-full bg-gold/60" aria-hidden />
                  {col.title}
                </h2>
                <ul className="space-y-2 text-[13px]">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <ClanLink
                        href={l.href}
                        className={
                          l.highlight
                            ? 'text-gold/85 transition-colors hover:text-gold-light'
                            : 'transition-colors hover:text-foreground'
                        }
                      >
                        {l.label}
                      </ClanLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-10 border-t border-card-border-soft pt-5 text-[12px] text-text-dim">
          Built by{' '}
          <a
            href="https://github.com/AhmedFathy2001"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold/85 transition-colors hover:text-gold-light"
          >
            Ahmed Fathy
          </a>
          {' · '}
          <a
            href="https://github.com/AhmedFathy2001/anvil"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Source-available
          </a>
          {' · '}
          <span title={`build ${GIT_SHA}`} className="tabular-nums">
            v{APP_VERSION}
          </span>
        </p>
      </div>
    </footer>
  );
}
