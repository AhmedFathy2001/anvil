import type { ShownFeatured } from '@/lib/spacePage/store';

const PLATFORM: Record<string, string> = { twitch: 'Twitch', youtube: 'YouTube', kick: 'Kick', medal: 'Medal' };

/**
 * The one clip a creator pinned to the top of their space (lib/spacePage): one of their own stream
 * highlights, or a Twitch / YouTube / Kick / Medal clip link. Link-out only — no embedded player and
 * no picture from the platform: the page shows images from our own media host only.
 */
export default function CreatorFeatured({ featured }: { featured: ShownFeatured | null }) {
  if (!featured) return null;
  const href = featured.kind === 'highlight' ? (featured.highlight.clipUrl ?? featured.highlight.vodUrl) : featured.url;
  if (!href) return null;
  const platform = featured.kind === 'highlight' ? featured.highlight.platform : featured.platform;
  const title = featured.kind === 'highlight' ? featured.highlight.title : featured.title || 'Featured clip';
  const sub = featured.kind === 'highlight' ? featured.highlight.eventName : null;

  return (
    <section className="mt-6" aria-label="Featured clip">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group flex items-center gap-4 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 via-card-bg to-card-bg p-4 transition-colors hover:border-gold/60 sm:p-5"
      >
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold transition-colors group-hover:bg-gold/25"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M8 5.5v13l10.5-6.5Z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10.5px] uppercase tracking-[0.16em] text-gold">Featured</span>
          <span className="block truncate text-[16px] font-semibold text-foreground">{title}</span>
          <span className="block truncate text-[12.5px] text-text-muted">
            {sub ? `${sub} · ` : ''}Watch on {PLATFORM[platform] ?? platform}
          </span>
        </span>
      </a>
    </section>
  );
}
