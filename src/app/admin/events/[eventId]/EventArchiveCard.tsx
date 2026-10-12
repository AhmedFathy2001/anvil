import ClanLink from '@/components/ClanLink';
import { MEDIA_RETENTION_DAYS, eventMediaPurgeAt } from '@/lib/eventMediaRetentionRules';

// The finished event's archive: a zip of every record and proof image (api/admin/events/[id]/archive),
// and the date the proof images leave Anvil's storage (lib/eventMediaRetention). Said here, on the
// page an organiser opens after an event, so the deletion is never a surprise.

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function EventArchiveCard({
  event,
  now,
}: {
  event: { id: number; endDate: string | null; forceEndedAt: string | null; mediaPurgedAt: string | null };
  /** Render time, passed in so the countdown is a value the page chose rather than a clock read mid-render. */
  now: number;
}) {
  const purgeAt = eventMediaPurgeAt(event);
  const purged = event.mediaPurgedAt ? new Date(event.mediaPurgedAt) : null;
  const daysLeft = purgeAt ? Math.ceil((purgeAt.getTime() - now) / 86_400_000) : null;

  return (
    <section className="mt-6 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="h-5 w-1 rounded bg-gold" aria-hidden />
            Event archive
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            One zip with the board, teams, every completion and submission, payouts and fees — and every proof
            image, filed by tile and team, with a page to browse it offline.
          </p>
          <p className={`mt-2 text-sm ${purged ? 'text-text-muted' : daysLeft != null && daysLeft <= 14 ? 'text-gold' : 'text-text-muted'}`}>
            {purged
              ? `Proof images were deleted on ${fmt(purged)}, ${MEDIA_RETENTION_DAYS} days after the event ended. The archive still has every record.`
              : purgeAt
                ? `Proof images are kept for ${MEDIA_RETENTION_DAYS} days after the event ends, until ${fmt(purgeAt)}${
                    daysLeft != null && daysLeft > 0 ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)` : ''
                  }. Results and who did what are kept for good.`
                : `Proof images are kept for ${MEDIA_RETENTION_DAYS} days after the event ends. Results and who did what are kept for good.`}
          </p>
        </div>
        {/* prefetch off: a prefetch would build the whole zip just because the card was on screen. The
            download attribute keeps Next's router out of it, so the browser saves the file. */}
        <ClanLink
          href={`/api/admin/events/${event.id}/archive`}
          prefetch={false}
          download
          className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Download archive (.zip)
        </ClanLink>
      </div>
    </section>
  );
}
