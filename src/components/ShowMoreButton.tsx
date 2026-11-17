'use client';

/**
 * The button under a list that is drawn in chunks: "Show 25 more (60 left)". Renders nothing once
 * everything is on screen. The caller keeps the limit (`useState(chunk)`) and slices its own rows,
 * so search and filters still run over the whole list.
 */
export default function ShowMoreButton({
  total,
  shown,
  chunk,
  onMore,
  className = '',
}: {
  total: number;
  shown: number;
  chunk: number;
  onMore: () => void;
  className?: string;
}) {
  const left = total - shown;
  if (left <= 0) return null;
  return (
    <button
      type="button"
      onClick={onMore}
      className={`w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-muted transition-colors hover:border-gold/50 hover:text-foreground ${className}`}
    >
      Show {Math.min(chunk, left)} more{left > chunk ? ` (${left} left)` : ''}
    </button>
  );
}
