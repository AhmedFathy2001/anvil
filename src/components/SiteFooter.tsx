import ClanLink from '@/components/ClanLink';
import { APP_VERSION, GIT_SHA } from '@/lib/serverInfo';

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
export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-card-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-text-muted sm:flex-row sm:px-6">
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
        <div className="flex items-center gap-4">
          <ClanLink href="/guide" className="transition-colors hover:text-foreground">
            Guides
          </ClanLink>
          <ClanLink href="/feedback" className="transition-colors hover:text-foreground">
            Feedback &amp; bug reports
          </ClanLink>
        </div>
      </div>
    </footer>
  );
}
