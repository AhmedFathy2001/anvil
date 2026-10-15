'use client';

import { useState } from 'react';

import ClanLink from '@/components/ClanLink';

export interface PlayerListItem {
  key: number;
  name: string;
  team: string | null;
  color: string | null;
}

/** Everyone with a card, filterable by name — a big event has hundreds. */
export default function PlayerList({ eventId, players }: { eventId: number; players: PlayerListItem[] }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? players.filter((p) => p.name.toLowerCase().includes(needle)) : players;
  return (
    <div>
      {players.length > 12 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a player"
          className="mb-3 w-full max-w-xs rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm"
        />
      )}
      {shown.length === 0 ? (
        <p className="text-sm text-text-muted">Nobody by that name has a card.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <ClanLink
              key={p.key}
              href={`/events/${eventId}/wrapped/p/${p.key}`}
              className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm hover:border-gold/60 transition-colors"
            >
              <span className="h-4 w-1 rounded-full shrink-0" style={{ background: p.color ?? 'var(--color-gold)' }} />
              <span className="font-medium truncate">{p.name}</span>
              {p.team && <span className="ml-auto text-xs text-text-muted truncate">{p.team}</span>}
            </ClanLink>
          ))}
        </div>
      )}
    </div>
  );
}
