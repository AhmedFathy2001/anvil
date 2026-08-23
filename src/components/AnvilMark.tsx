/**
 * The anvil. The site's mark, as geometry rather than a 48px favicon.
 *
 * It is the same shape as `/icon-192.png` — a top slab, a narrow waist, a splayed base — redrawn as
 * a path so it can be a 500px watermark behind the hero without going to mush. The favicon stays
 * where it is; this is for anywhere the mark needs to be large or to take the page's own colour.
 *
 * Squared-off, with the corners cut rather than rounded, because the thing is struck metal. The
 * horn is deliberately absent: the favicon has none, and inventing one here would make the mark and
 * the tab icon two different anvils.
 */
export default function AnvilMark({
  size = 24,
  className,
  title,
}: {
  size?: number | string;
  className?: string;
  /** Give it one only where the mark carries meaning on its own; decorative uses stay silent. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* Top slab — the face, cut back at both ends. */}
      <path d="M14 20 h72 l6 7 v9 h-84 v-9 z" />
      {/* Waist — off-centre, as it is on the icon. */}
      <path d="M38 36 h24 v26 h-24 z" />
      {/* Base — flared, sitting flat. */}
      <path d="M22 62 h56 l6 8 v10 h-68 v-10 z" />
    </svg>
  );
}
