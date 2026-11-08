'use client';

import { useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import type { ItemOdds } from '@/lib/itemOdds';

const fmtHours = (h: number) => (h >= 10 ? `${Math.round(h).toLocaleString()} h` : `${h.toFixed(1)} h`);

/**
 * "1 in 512 from Zulrah · ~512 kills ≈ 26 h" for each tracked item on a drop tile: what the wiki's
 * drop rate and our kill rate expect, so a team knows what it's signing up for.
 */
export default function DropOdds({ itemIds, names }: { itemIds: number[]; names?: Map<number, string> }) {
  const [odds, setOdds] = useState<ItemOdds[]>([]);
  const key = itemIds.join(',');
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    clanFetch(`/api/items/odds?ids=${key}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((body: { items: ItemOdds[] }) => {
        if (!cancelled) setOdds(body.items ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);
  if (odds.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-text-muted">
      {odds.slice(0, 8).map((o) => (
        <li key={o.itemId}>
          {names?.get(o.itemId) ? <span className="text-foreground">{names.get(o.itemId)}: </span> : null}
          1 in {Math.round(o.denominator).toLocaleString()}
          {o.rolls > 1 ? ` (×${o.rolls} rolls)` : ''} from {o.source} · ~{Math.round(o.expectedKills).toLocaleString()} kills
          {o.hours != null ? ` ≈ ${fmtHours(o.hours)} at ${o.killsPerHour}/h` : ''}
        </li>
      ))}
    </ul>
  );
}
