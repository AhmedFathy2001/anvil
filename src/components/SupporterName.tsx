import { useId } from 'react';

import SupporterFlairPopover from '@/components/SupporterFlairPopover';
import {
  FLAIR_BACKGROUND,
  OPAQUE_CHAT_BACKGROUND,
  supporterGradientCss,
  supporterInk,
  supporterInkOn,
  type SupporterStyle,
} from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';

/**
 * A name with its Anvil Supporter flair: a star and the tier's colour (gold, a gradient, a gradient
 * that keeps moving). The star wears the same colours as the name. With no tier it is just the name, so callers can wrap every name without
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
  star = true,
  surface = 'site',
}: {
  name: string;
  tier: SupporterTierId | null | undefined;
  className?: string;
  /** No popover on the star: the tier page itself, your own Supporter section, inside a link. */
  plain?: boolean;
  /** Their chosen name colours; gated by `tier` here, so a lapsed choice just shows the default. */
  style?: SupporterStyle | null;
  /** Leave the star off where the row already carries a star of its own (the locker's "main" chip). */
  star?: boolean;
  /** Preview the derived readable colours used over RuneScape's opaque chat background. */
  surface?: 'site' | 'opaque-chat';
}) {
  if (!tier) return <span className={className}>{name}</span>;
  const sourceInk = supporterInk(tier, style);
  const ink = surface === 'opaque-chat'
    ? supporterInkOn(sourceInk, OPAQUE_CHAT_BACKGROUND, '#000000', 4.5)
    : supporterInkOn(sourceInk, FLAIR_BACKGROUND, '#ffffff', 4.5);
  const gradient = supporterGradientCss(ink);
  // The star in the name's own stops (their chosen ones, else the tier's); gold has none.
  const stops = ink.grad ?? null;
  const solid = stops ? null : ink.color;
  return (
    <span className={`supporter-flair inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {!star ? null : plain ? (
        <SupporterStar stops={stops} color={solid} />
      ) : (
        <SupporterFlairPopover tier={tier}>
          <SupporterStar decorative stops={stops} color={solid} />
        </SupporterFlairPopover>
      )}
      <span
        className={`supporter-name-${tier} truncate`}
        style={gradient
          ? { backgroundImage: gradient }
          : { backgroundImage: 'none', color: ink.color, WebkitTextFillColor: ink.color }}
      >
        {name}
      </span>
    </span>
  );
}

export function SupporterStar({
  size = 14,
  decorative = false,
  stops = null,
  color = null,
}: {
  size?: number;
  decorative?: boolean;
  /** Paint the star with these gradient stops instead of gold. */
  stops?: readonly string[] | null;
  /** Static custom colour when there is no gradient. */
  color?: string | null;
}) {
  const id = useId();
  const grad = stops && stops.length >= 2 ? stops : null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={grad ? `url(#${id})` : 'currentColor'}
      className="shrink-0 text-gold-light"
      style={color ? { color } : undefined}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Anvil Supporter' })}
    >
      {grad && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {grad.map((c, i) => (
              <stop key={i} offset={grad.length === 1 ? 0 : i / (grad.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
      )}
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" />
    </svg>
  );
}
