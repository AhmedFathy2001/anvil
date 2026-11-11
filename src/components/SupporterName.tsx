import { useId } from 'react';

import SupporterFlairPopover from '@/components/SupporterFlairPopover';
import { inkForSurface, supporterGradientCss, supporterInk, type SupporterStyle } from '@/lib/supporterStyle';
import { TENURE_LADDER, type SupporterTierId, type TenureStepId } from '@/lib/supporterTiers';
import { TENURE_SPRITES, tenureTones } from '@/lib/tenureSprites';

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
  if (tenure) return <TenureBadge step={tenure} color={color ?? grad?.[0] ?? '#ffd35c'} size={Math.round(size * 1.3)} decorative={decorative} />;
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

/**
 * A tenure badge: the step's pixel sprite (lib/tenureSprites, the plugin's own art), crisp squares in
 * three tones of the name's colour. A gem that grows, gains wings, then a laurel for Legend.
 */
export function TenureBadge({ step, color, size = 18, decorative = false }: { step: TenureStepId; color: string; size?: number; decorative?: boolean }) {
  const k = TENURE_LADDER.findIndex((t) => t.id === step);
  const rows = TENURE_SPRITES[Math.max(0, k)];
  const tones = tenureTones(/^#[0-9a-f]{6}$/i.test(color) ? color : '#ffd35c');
  const name = TENURE_LADDER[Math.max(0, k)].name;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 11 11"
      shapeRendering="crispEdges"
      className="shrink-0"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `Anvil Supporter · ${name}` })}
    >
      {rows.flatMap((r, y) =>
        [...r].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={tones[ch as 'k' | '#' | '+']} />)),
      )}
    </svg>
  );
}
