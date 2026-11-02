import type { SupporterTierId } from '@/lib/supporterTiers';

/**
 * A name with its Anvil Supporter flair: a star and the tier's colour (gold, gradient, animated
 * gradient). With no tier it is just the name, so callers can wrap every name without branching.
 * Styles live in globals.css (`.supporter-name-*`).
 */
export default function SupporterName({
  name,
  tier,
  className = '',
}: {
  name: string;
  tier: SupporterTierId | null | undefined;
  className?: string;
}) {
  if (!tier) return <span className={className}>{name}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <SupporterStar />
      <span className={`supporter-name-${tier} truncate`}>{name}</span>
    </span>
  );
}

export function SupporterStar({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0 text-gold-light"
      role="img"
      aria-label="Anvil Supporter"
    >
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" />
    </svg>
  );
}
