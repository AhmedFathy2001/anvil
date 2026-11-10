import { useId } from 'react';

import SupporterFlairPopover from '@/components/SupporterFlairPopover';
import { inkForSurface, supporterGradientCss, supporterInk, type SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId, TenureStepId } from '@/lib/supporterTiers';

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
  tenure = null,
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
  /** How long they've supported without a break: the star's shape (lib/supporterTiers TENURE_LADDER). */
  tenure?: { id: TenureStepId; months: number } | null;
}) {
  if (!tier) return <span className={className}>{name}</span>;
  const sourceInk = supporterInk(tier, style);
  // The site is dark-only; the opaque chat preview is the light surface.
  const ink = inkForSurface(sourceInk, surface === 'opaque-chat' ? 'light' : 'dark');
  const gradient = supporterGradientCss(ink);
  // The star in the name's own stops (their chosen ones, else the tier's); gold has none.
  const stops = ink.grad ?? null;
  const solid = stops ? null : ink.color;
  return (
    <span className={`supporter-flair inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {!star ? null : plain ? (
        <SupporterStar stops={stops} color={solid} tenure={tenure?.id} />
      ) : (
        <SupporterFlairPopover tier={tier} tenure={tenure} name={name}>
          <SupporterStar decorative stops={stops} color={solid} tenure={tenure?.id} />
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
  tenure = null,
}: {
  size?: number;
  /** The tenure step's frame round the star; none (or Apprentice) is the bare star. */
  tenure?: TenureStepId | null;
  decorative?: boolean;
  /** Paint the star with these gradient stops instead of gold. */
  stops?: readonly string[] | null;
  /** Static custom colour when there is no gradient. */
  color?: string | null;
}) {
  const id = useId();
  const grad = stops && stops.length >= 2 ? stops : null;
  const paint = grad ? `url(#${id})` : 'currentColor';
  const framed = tenure != null && tenure !== 'apprentice';
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
      {framed && <TenureFrame step={tenure!} paint={paint} />}
      <path
        d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"
        transform={framed ? 'translate(12 12) scale(0.56) translate(-12 -11.6)' : undefined}
      />
    </svg>
  );
}

const HEX = '12,1.4 21.2,6.7 21.2,17.3 12,22.6 2.8,17.3 2.8,6.7';

/** The shape that grows round the star with tenure: ring, double ring, hex, double hex, Legend's rays. */
function TenureFrame({ step, paint }: { step: TenureStepId; paint: string }) {
  switch (step) {
    case 'journeyman':
      return <circle cx="12" cy="12" r="10.4" fill="none" stroke={paint} strokeWidth="1.7" />;
    case 'artisan':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke={paint} strokeWidth="1.6" />
          <circle cx="12" cy="12" r="11.3" fill="none" stroke={paint} strokeWidth="1" strokeDasharray="1.6 2.2" />
        </>
      );
    case 'master':
      return <polygon points={HEX} fill="rgba(0,0,0,0.35)" stroke={paint} strokeWidth="1.7" strokeLinejoin="round" />;
    case 'grandmaster':
      return (
        <>
          <polygon points={HEX} fill="none" stroke={paint} strokeWidth="1" strokeLinejoin="round" />
          <polygon points={HEX} transform="translate(12 12) scale(0.8) translate(-12 -12)" fill="rgba(0,0,0,0.35)" stroke={paint} strokeWidth="2" strokeLinejoin="round" />
        </>
      );
    case 'legend':
      return (
        <>
          <g className="tenure-rays" stroke={paint} strokeWidth="1.2" strokeLinecap="round" opacity="0.75">
            <path d="M12 0v2.2M12 21.8V24M0 12h2.2M21.8 12H24M3.5 3.5l1.5 1.5M19 19l1.5 1.5M20.5 3.5L19 5M5 19l-1.5 1.5" />
          </g>
          <polygon points={HEX} transform="translate(12 12) scale(0.82) translate(-12 -12)" fill={paint} fillOpacity="0.28" stroke={paint} strokeWidth="1.8" strokeLinejoin="round" />
        </>
      );
    default:
      return null;
  }
}
