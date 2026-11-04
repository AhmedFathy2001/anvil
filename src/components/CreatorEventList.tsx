import ClanLink from '@/components/ClanLink';
import { CREATOR_EVENT_GROUPS, CREATOR_STAFF_ONLY_TAG, type CreatorEventGroup } from '@/lib/creatorSpaces';
import type { CreatorEventItem, CreatorEventsView } from '@/lib/creatorHome';

/** "Nov 7" — day-level; the event pages carry the times. */
function shortDate(iso: string): string {
  const t = Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

function EventRow({ item, group }: { item: CreatorEventItem; group: CreatorEventGroup }) {
  return (
    <li className="border-t border-card-border/70 first:border-t-0">
      <ClanLink
        href={item.href}
        className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-card-bg-hover"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            {group === 'live' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-label="Live" />}
            <span className="truncate font-medium">{item.name}</span>
            {item.staffOnly && (
              <span className="shrink-0 rounded-full border border-card-border px-2 py-px text-[11px] text-text-muted">
                {CREATOR_STAFF_ONLY_TAG}
              </span>
            )}
          </span>
          <span className="block text-[12.5px] text-text-muted">
            {item.kind}
            {item.line && <> · {item.line}</>}
          </span>
        </span>
        <span className="text-right text-[13px]">
          {item.top ? (
            <>
              <span className="block">{item.top.name}</span>
              <span className="block text-[12px] text-text-muted">{item.top.text}</span>
            </>
          ) : group === 'open' ? (
            <span className="text-[12.5px] font-medium text-gold">Join →</span>
          ) : (
            <span className="font-mono text-[12.5px] text-text-dim">{item.when ? shortDate(item.when) : ''}</span>
          )}
        </span>
      </ClanLink>
    </li>
  );
}

/**
 * A creator space's events, grouped by lib/creatorSpaces CREATOR_EVENT_GROUPS: live now, open to
 * join, coming up, finished. Shared by the space's home and its /events page so both list the same
 * rows the header counts.
 */
export default function CreatorEventList({ events }: { events: CreatorEventsView }) {
  if (events.count === 0) {
    return (
      <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-5 text-sm text-text-muted">
        No events yet. Check back soon.
      </div>
    );
  }
  return (
    <>
      {CREATOR_EVENT_GROUPS.map(({ key, title }) => {
        const items = events.groups[key];
        if (items.length === 0) return null;
        return (
          <section key={key} className="mt-8">
            <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold">
              <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
              {title}
            </h2>
            <ul
              className={`overflow-hidden rounded-xl border bg-card-bg ${key === 'live' ? 'border-emerald-500/30' : 'border-card-border'}`}
            >
              {items.map((item) => (
                <EventRow key={item.key} item={item} group={key} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
