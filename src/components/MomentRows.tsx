'use client';

import { useState, type ReactNode } from 'react';
import { MOMENT_FILTERS, momentMatchesFilter, type MomentFilter } from '@/lib/momentFilter';

/**
 * The feed's rows with filter chips above them. The rows are rendered on the server and handed in
 * as nodes, so filtering is only a show/hide over them.
 */
export default function MomentRows({ items }: { items: { id: number; kind: string; node: ReactNode }[] }) {
  const [filter, setFilter] = useState<MomentFilter>('all');
  const shown = items.filter((i) => momentMatchesFilter(i.kind, filter));
  return (
    <>
      <div role="tablist" aria-label="Filter the feed" className="mb-2 flex flex-wrap gap-1.5">
        {MOMENT_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.key
                ? 'border-gold/60 bg-gold/10 text-gold'
                : 'border-card-border text-text-muted hover:border-gold/40 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-card-border/60 rounded-xl border border-card-border bg-card-bg px-4">
        {shown.map((i) => (
          <div key={i.id}>{i.node}</div>
        ))}
        {shown.length === 0 && <p className="py-6 text-center text-[13px] text-text-muted">Nothing of that kind yet.</p>}
      </div>
    </>
  );
}
