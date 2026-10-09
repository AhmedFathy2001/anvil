import { cn } from '@/lib/utils';
import { claimColor, claimInitials, type ClaimMarker } from '@/lib/tileClaimsView';

/**
 * Teammates planning a tile, as a stack of coloured initials (lib/tileClaims). Each person keeps the
 * same colour everywhere — the plan panel, the grid, the list — so you learn to read who's who at a
 * glance. Yours carries a gold ring.
 */
export default function ClaimAvatars({
  claims,
  size = 'sm',
  max = 3,
  label = 'Planning',
  className,
}: {
  claims: ClaimMarker[];
  size?: 'xs' | 'sm' | 'md';
  max?: number;
  label?: string;
  className?: string;
}) {
  if (claims.length === 0) return null;
  const dim = size === 'xs' ? 'h-3.5 w-3.5 text-[6px] sm:h-4 sm:w-4 sm:text-[7px]' : size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-8 w-8 text-xs';
  const overflowDim = size === 'xs'
    ? 'h-3.5 min-w-3.5 px-0.5 text-[6px] sm:h-4 sm:min-w-4 sm:text-[7px]'
    : size === 'sm'
      ? 'h-5 min-w-5 px-1 text-[9px]'
      : 'h-8 min-w-8 px-1.5 text-xs';
  const shown = claims.slice(0, max);
  const extra = claims.length - shown.length;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center -space-x-1.5', className)}
      title={`${label}: ${claims.map((c) => (c.mine ? 'you' : c.name)).join(', ')}`}
    >
      {shown.map((c) => (
        <span
          key={c.name}
          className={cn(
            'grid place-items-center rounded-full border font-bold leading-none text-white',
            dim,
            c.mine ? 'border-gold ring-1 ring-gold' : 'border-brown-dark',
          )}
          style={{ backgroundColor: claimColor(c.name) }}
        >
          {claimInitials(c.name)}
        </span>
      ))}
      {extra > 0 && (
        <span className={cn('grid place-items-center whitespace-nowrap rounded-full border border-brown-dark bg-card-border font-semibold leading-none text-text-muted', overflowDim)}>
          +{extra}
        </span>
      )}
    </span>
  );
}
