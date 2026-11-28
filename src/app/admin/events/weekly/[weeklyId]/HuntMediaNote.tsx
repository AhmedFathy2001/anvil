import { MEDIA_RETENTION_DAYS, effectivePurgeAt } from '@/lib/eventMediaRetentionRules';

// When an item hunt's or Boss Rush's drop screenshots leave Anvil's storage (lib/huntMediaRetention),
// said on its admin page like an event's archive card, so the deletion is never a surprise.

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function HuntMediaNote({
  comp,
  now,
}: {
  comp: { endDate: string; mediaPurgedAt: string | null; mediaPurgeNoticeAt: string | null; mediaPurgeFinalNoticeAt: string | null };
  now: number;
}) {
  const purgeAt = effectivePurgeAt({ ...comp, forceEndedAt: null }, new Date(now));
  const purged = comp.mediaPurgedAt ? new Date(comp.mediaPurgedAt) : null;
  const daysLeft = purgeAt ? Math.ceil((purgeAt.getTime() - now) / 86_400_000) : null;
  return (
    <p className={`mx-auto mt-4 max-w-5xl px-4 text-xs ${!purged && daysLeft != null && daysLeft <= 14 ? 'text-gold' : 'text-text-muted'}`}>
      {purged
        ? `Drop screenshots were deleted on ${fmt(purged)}, ${MEDIA_RETENTION_DAYS} days after it ended. Every drop, point and standing is kept.`
        : purgeAt
          ? `Drop screenshots are kept for ${MEDIA_RETENTION_DAYS} days after it ends, until ${fmt(purgeAt)}${
              daysLeft != null && daysLeft > 0 ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)` : ''
            }. Owners and admins get a reminder on Discord 14 and 3 days before. Every drop, point and standing is kept for good.`
          : `Drop screenshots are kept for ${MEDIA_RETENTION_DAYS} days after it ends.`}
    </p>
  );
}
