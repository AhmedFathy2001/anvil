import type { ShownHighlight } from '@/lib/highlights/rules';
import ReportButton from '@/components/ReportButton';

/**
 * Stream highlights (lib/highlights): clips and stream timestamps of a streamed event's big moments.
 *
 * Link-out only. Each card opens the clip (or the stream at that second) on Twitch / YouTube in a new
 * tab. No embedded player: an iframe would need the site's CSP opened to Twitch's player and a
 * `parent=` per host, and a thumbnail that opens the real thing does the job.
 *
 * The caller has already filtered to what this viewer may see (the event, and hidden standings).
 */
export default function HighlightsStrip({
  highlights,
  title = 'Highlights',
  blurb = 'clipped live from the stream',
  showEvent = false,
  canReport = false,
}: {
  highlights: (ShownHighlight & { eventName?: string })[];
  title?: string;
  blurb?: string;
  /** Name the event on each card (a page that lists several events' clips). */
  showEvent?: boolean;
  /** The viewer is signed in, so each card gets a small Report flag (lib/platformReports). */
  canReport?: boolean;
}) {
  if (highlights.length === 0) return null;
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
          {title}
        </h2>
        <span className="text-[11.5px] text-text-muted">{blurb}</span>
      </div>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto overflow-y-hidden px-1 pb-2">
        {highlights.map((h) => (
          <li key={h.id} className="w-56 shrink-0 snap-start">
            <HighlightCard h={h} showEvent={showEvent} canReport={canReport} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function platformLabel(p: ShownHighlight['platform']): string {
  return p === 'youtube' ? 'YouTube' : 'Twitch';
}

function HighlightCard({ h, showEvent, canReport }: { h: ShownHighlight & { eventName?: string }; showEvent: boolean; canReport: boolean }) {
  const href = h.clipUrl ?? h.vodUrl!;
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
      <a href={href} target="_blank" rel="noopener noreferrer" className="group block" title={`Open on ${platformLabel(h.platform)}`}>
        <div className="relative aspect-video w-full bg-brown-dark">
          {h.thumbnailUrl ? (
            // A Twitch CDN image (lib/highlights/rules safeThumbnailUrl), sized by the card.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={h.thumbnailUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-opacity group-hover:opacity-85"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[12px] text-text-muted">
              {h.clipUrl ? 'Clip' : 'Watch the moment'}
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10.5px] text-white">
            {h.clipUrl ? (h.durationS ? `${Math.round(h.durationS)}s clip` : 'clip') : 'stream'}
          </span>
        </div>
        <div className="px-3 pt-2">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground group-hover:text-gold">{h.title}</p>
        </div>
      </a>
      <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1 text-[11.5px] text-text-muted">
        <span className="min-w-0 truncate">
          {showEvent && h.eventName ? `${h.eventName} · ` : ''}
          {h.channelName}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {h.clipUrl && h.vodUrl && (
            <a href={h.vodUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              In the stream
            </a>
          )}
          {canReport && <ReportButton type="highlight" id={h.id} iconOnly />}
        </span>
      </div>
    </div>
  );
}

/** The small links beside a moment in a feed: its clip, and/or the stream at that second. */
export function MomentStreamLinks({ links }: { links: { clipUrl: string | null; vodUrl: string | null } | undefined }) {
  if (!links || (!links.clipUrl && !links.vodUrl)) return null;
  return (
    <span className="flex shrink-0 gap-2 text-[11px]">
      {links.clipUrl && (
        <a href={links.clipUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light">
          Clip
        </a>
      )}
      {links.vodUrl && (
        <a href={links.vodUrl} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-gold">
          Stream
        </a>
      )}
    </span>
  );
}
