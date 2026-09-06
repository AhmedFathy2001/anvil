'use client';

import ClanLink from '@/components/ClanLink';

/**
 * A quiet pointer from a control to the page that explains it.
 *
 * The admin surfaces had no links to the guides at all — fifteen translated pages that only somebody
 * already on `/guide` could find. The help belongs where the question is asked, so this sits in the
 * header of a card rather than at the bottom of a page: small, out of the way of the work, and gone
 * from your eye once you know the answer.
 *
 * `/guide` is a clan-scoped path, so ClanLink keeps the `/c/<slug>` prefix and the reader stays
 * inside the clan they were administering.
 */
export default function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <ClanLink
      href={href}
      className="text-[11px] text-text-muted hover:text-gold transition-colors whitespace-nowrap"
    >
      {children} <span aria-hidden="true">→</span>
    </ClanLink>
  );
}
