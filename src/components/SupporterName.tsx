import SupporterFlairPopover from '@/components/SupporterFlairPopover';
import { supporterGradientCss, supporterInk, type SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';

/**
 * A name with its Anvil Supporter flair: a star and the tier's colour (gold, gradient, a gradient
 * that moves on hover). With no tier it is just the name, so callers can wrap every name without
 * branching.
 * Styles live in globals.css (`.supporter-name-*`); a person's own colours (a Champion preset, a
 * Patron's custom stops, lib/supporterStyle) replace only the gradient, inline, so the class keeps
 * the clipping and the Patron motion.
 */
export default function SupporterName({
  name,
  tier,
  className = '',
  plain = false,
  style = null,
}: {
  name: string;
  tier: SupporterTierId | null | undefined;
  className?: string;
  /** No popover on the star: the tier page itself, your own Supporter section, inside a link. */
  plain?: boolean;
  /** Their chosen name colours; gated by `tier` here, so a lapsed choice just shows the default. */
  style?: SupporterStyle | null;
}) {
  if (!tier) return <span className={className}>{name}</span>;
  const gradient = style ? supporterGradientCss(supporterInk(tier, style)) : null;
  return (
    <span className={`supporter-flair inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {plain ? (
        <SupporterStar />
      ) : (
        <SupporterFlairPopover tier={tier}>
          <SupporterStar decorative />
        </SupporterFlairPopover>
      )}
      <span className={`supporter-name-${tier} truncate`} style={gradient ? { backgroundImage: gradient } : undefined}>
        {name}
      </span>
    </span>
  );
}

export function SupporterStar({ size = 14, decorative = false }: { size?: number; decorative?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0 text-gold-light"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Anvil Supporter' })}
    >
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" />
    </svg>
  );
}
