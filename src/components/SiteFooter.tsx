import { headers } from 'next/headers';

import ClanLink from '@/components/ClanLink';
import { APP_VERSION, GIT_SHA } from '@/lib/serverInfo';
import { isApexHost } from '@/lib/clanContext';

/**
 * The footer, and the licence's attribution.
 *
 * A COMPONENT BECAUSE IT HAS TWO HOMES. A clan page is one column under a top nav, so the footer
 * spans the window. The apex is a rail beside a column, and the footer belongs in the COLUMN —
 * rendered as a sibling of the whole row it ran underneath the rail, starting at x=0 while every
 * other thing on the page started at 240, and centred its own text on the window rather than on the
 * content beside it. The bottom of the page looked like it had come apart, because it had.
 *
 * AUTHOR ATTRIBUTION — required by LICENSE (PolyForm Noncommercial 1.0.0 + Attribution). The
 * "Built by Ahmed Fathy" credit and its link must remain visible in any deployment or derivative
 * work. There is no donation-link carve-out: nothing in this block is optional.
 */
export default async function SiteFooter() {
  // About and Pricing are apex-only pages (they 404 on a clan host by design), so link them only
  // where they resolve. /guide and /feedback are instance-aware and work on every host, so they
  // always show.
  const onApex = isApexHost((await headers()).get('host'));
  return (
    <footer className="mt-16 border-t border-card-border">
      {/* Centred and stacked on a phone, spread on a desktop — and the type steps down, because the
          footer is the one block on the page that is never what somebody came for. */}
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-[12.5px] text-text-muted sm:flex-row sm:px-6 sm:text-left sm:text-sm">
        <p>
          Built by{' '}
          <a
            href="https://github.com/AhmedFathy2001"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold transition-colors hover:text-gold-light"
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
            Anvil is source-available
          </a>
          {' · '}
          <span title={`build ${GIT_SHA}`}>v{APP_VERSION}</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {onApex && (
            <>
              <ClanLink href="/about" className="transition-colors hover:text-foreground">
                About
              </ClanLink>
              <ClanLink href="/pricing" className="transition-colors hover:text-foreground">
                Pricing
              </ClanLink>
              <ClanLink href="/portal" className="transition-colors hover:text-foreground">
                Billing
              </ClanLink>
            </>
          )}
          <ClanLink href="/guide" className="transition-colors hover:text-foreground">
            Guides
          </ClanLink>
          <ClanLink href="/feedback" className="transition-colors hover:text-foreground">
            Feedback &amp; bug reports
          </ClanLink>
          <ClanLink href="/legal/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </ClanLink>
          <ClanLink href="/legal/terms" className="transition-colors hover:text-foreground">
            Terms
          </ClanLink>
          <ClanLink href="/legal/refunds" className="transition-colors hover:text-foreground">
            Refunds
          </ClanLink>
        </div>
      </div>
    </footer>
  );
}
