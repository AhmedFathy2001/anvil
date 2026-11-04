import type { CreatorPlayer } from '@/lib/creatorHome';

/**
 * A creator space's players: everybody who has signed up for one of its events. Read-only — they
 * are guests of the events, not a roster to manage. Removing someone from an event is the event's
 * own sign-ups page.
 */
export default function CreatorPlayers({ players, title = 'Players' }: { players: CreatorPlayer[]; title?: string }) {
  return (
    <section className="mt-2">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        {title}
        <span className="text-sm font-normal text-text-muted">{players.length}</span>
      </h2>
      {players.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 text-sm text-text-muted">
          Nobody yet. Copy an invite link and share it on stream or in Discord.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
          {players.map((p) => (
            <li
              key={p.accountId}
              className="flex items-center justify-between gap-4 border-t border-card-border/70 px-4 py-2.5 text-sm first:border-t-0"
            >
              <span className="min-w-0 truncate font-medium">{p.rsn}</span>
              <span className="shrink-0 text-text-muted">
                {p.events} event{p.events === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
