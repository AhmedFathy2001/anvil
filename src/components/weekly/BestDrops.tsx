'use client';

import { useState } from 'react';

import LocalTime from '@/components/LocalTime';
import ThingIcon from '@/components/ThingIcon';
import { BEST_DROPS_SHOWN, type BestDrop, bestDropFacts } from '@/lib/bestDrops';
import { itemIconUrl } from '@/lib/tileIcons';

/**
 * The competition's best drops, kept in front of people for as long as it runs and after it ends.
 * Pets first, then the rarest, then the dearest (lib/bestDrops). Renders nothing when there are none.
 */
export default function BestDrops({ drops }: { drops: BestDrop[] }) {
  const [all, setAll] = useState(false);
  if (drops.length === 0) return null;
  const shown = all ? drops : drops.slice(0, BEST_DROPS_SHOWN);
  return (
    <div className="mt-5 rounded-xl border border-gold/25 bg-card-bg p-4">
      <h3 className="text-sm font-bold">Best drops</h3>
      <p className="mt-0.5 text-xs text-text-muted">pets first, then the rarest. Reported by the plugin, never scored</p>
      <ul className="mt-2.5">
        {shown.map((d) => {
          const facts = bestDropFacts(d);
          return (
            <li key={d.key} className="flex items-center gap-2.5 border-t border-card-border/60 py-2 text-[12.5px] first:border-t-0">
              <ThingIcon src={d.itemId != null ? itemIconUrl(d.itemId) : null} alt="" size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  <b className="font-semibold text-foreground">{d.rsn}</b>
                  <span className="text-text-muted"> · </span>
                  <span className={d.pet ? 'text-gold-light' : 'text-foreground/90'}>{d.itemName}</span>
                  {d.count > 1 && <span className="text-text-muted"> ×{d.count}</span>}
                </span>
                <span className="block truncate text-[11px] text-text-muted">
                  {facts.map((f) => (
                    <span key={f}>{f} · </span>
                  ))}
                  <LocalTime date={d.occurredAt} format="short" />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {drops.length > BEST_DROPS_SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="mt-2 min-h-11 text-xs font-semibold text-gold hover:underline sm:min-h-0">
          {all ? 'Show fewer' : `Show all ${drops.length}`}
        </button>
      )}
    </div>
  );
}
