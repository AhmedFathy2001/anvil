import type { TextSegment } from '@/lib/spacePage/rules';
import type { ShownPanel } from '@/lib/spacePage/store';

import CreatorReportButton from './CreatorReportButton';

/**
 * Plain text with line breaks, its allowed https links as links (lib/spacePage/rules linkify, checked
 * against today's blocklist). React text nodes and <a> only — never HTML.
 */
function RichText({ segments, className }: { segments: TextSegment[]; className?: string }) {
  return (
    <p className={`whitespace-pre-line break-words ${className ?? ''}`}>
      {segments.map((s, i) =>
        s.href ? (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-gold underline-offset-2 hover:underline">
            {s.text}
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * A creator's "About" — their bio and up to eight panels, like a Twitch channel's — as a responsive
 * card grid (lib/spacePage). Hidden panels never reach here. Images are this space's own uploads
 * only; links open in a new tab, marked nofollow/ugc. Signed-in viewers get a "Report" on each.
 */
export default function CreatorPanels({
  clanId,
  bio,
  panels,
  canReport,
}: {
  clanId: number;
  bio: TextSegment[] | null;
  panels: ShownPanel[];
  /** The viewer is signed in. */
  canReport: boolean;
}) {
  if (!bio && panels.length === 0) return null;
  return (
    <section className="mt-8" aria-label="About">
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        About
      </h2>
      {bio && (
        <div className="mb-4 rounded-xl border border-card-border bg-card-bg p-5">
          <RichText segments={bio} className="text-[14.5px] leading-relaxed text-foreground/90" />
          {canReport && (
            <div className="mt-3 text-right">
              <CreatorReportButton clanId={clanId} label="Report this page" />
            </div>
          )}
        </div>
      )}
      {panels.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {panels.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-card-border bg-card-bg">
              {p.imageUrl &&
                (p.linkUrl ? (
                  <a href={p.linkUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="block">
                    {/* Our own media host only (lib/spacePage isSpaceMediaUrl). */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="" loading="lazy" className="block h-auto w-full" />
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" loading="lazy" className="block h-auto w-full" />
                ))}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-[15px] font-semibold text-foreground">{p.title}</h3>
                {p.body.length > 0 && <RichText segments={p.body} className="mt-1.5 text-[13.5px] leading-relaxed text-text-muted" />}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                  {p.linkUrl ? (
                    <a
                      href={p.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="truncate text-[13px] font-medium text-gold hover:text-gold-light"
                    >
                      {hostOf(p.linkUrl)} ↗
                    </a>
                  ) : (
                    <span />
                  )}
                  {canReport && <CreatorReportButton clanId={clanId} panelId={p.id} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Open link';
  }
}
