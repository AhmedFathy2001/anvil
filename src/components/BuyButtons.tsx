import type { BuyWording } from '@/lib/buyOffer';

/**
 * A tier's buy buttons (lib/buyOffer buyWording): "Start free trial" beside "Skip trial, pay now",
 * or one "Subscribe", or the not-yet-open state, with the line that says what happens to their card.
 */
export default function BuyButtons({ wording, staffNote = null, className = '' }: { wording: BuyWording; staffNote?: string | null; className?: string }) {
  const main = 'rounded-lg bg-gold px-4 py-2.5 text-center text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light';
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {wording.primary.href ? (
          <a
            // eslint-disable-next-line clan-scope/clan-prefix -- a Gumroad checkout or the site's own checkout route, never a clan path
            href={wording.primary.href}
            className={`${main} flex-1`}
          >
            {wording.primary.label}
          </a>
        ) : (
          <span aria-disabled="true" className="flex-1 cursor-default rounded-lg border border-card-border px-4 py-2.5 text-center text-sm font-semibold text-text-dim">
            {wording.primary.label}
          </span>
        )}
        {wording.secondary && (
          <a
            // eslint-disable-next-line clan-scope/clan-prefix -- a Gumroad checkout or the site's own checkout route, never a clan path
            href={wording.secondary.href}
            className="flex-1 rounded-lg border border-gold/40 px-4 py-2.5 text-center text-sm text-gold transition-colors hover:border-gold"
          >
            {wording.secondary.label}
          </a>
        )}
      </div>
      <p className="text-[12.5px] leading-relaxed text-text-muted">{wording.note}</p>
      {staffNote && <p className="text-[12px] leading-relaxed text-text-dim">Staff: {staffNote}</p>}
    </div>
  );
}
