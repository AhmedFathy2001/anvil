'use client';

import { useMemo, useState } from 'react';
import { HUB_KINDS } from '@/lib/hubKinds';
import type { HubItem } from '@/lib/eventsHub';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import CompetitionRow, { CompetitionRowList } from '@/components/events/CompetitionRow';
import { recordRow } from '@/lib/competitionRows';

/**
 * Everything the clan has run, boards and weeks in one list.
 *
 * The same row as everything above it on the page (components/events/CompetitionRow), so a finished
 * competition reads like a running one with a winner in the leader's place. Grouped by month so the
 * eye can find a period; it is paged, because a clan two years in has hundreds of these.
 *
 * The filter is Everything / Boards / Weeks with the ten specific kinds behind it — ten chips in a
 * row is the thing this page is trying not to be.
 */

const dateShort = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

const monthOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Undated';

type Scope = 'all' | 'boards' | 'weeks';

export default function HubRecord({
  items,
  pastTotal,
  boardsTotal,
  weeksTotal,
  showMoreHref,
}: {
  items: HubItem[];
  pastTotal: number;
  boardsTotal: number;
  weeksTotal: number;
  showMoreHref: string | null;
}) {
  const [scope, setScope] = useState<Scope>('all');
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (scope === 'all' || i.group === scope) &&
        (kinds.size === 0 || kinds.has(i.kind)) &&
        (q === '' || i.name.toLowerCase().includes(q) || (i.top?.name ?? '').toLowerCase().includes(q)),
    );
  }, [items, scope, kinds, query]);

  // Only the kinds that belong to the chosen scope get chips.
  const chipKinds = HUB_KINDS.filter((k) => scope === 'all' || k.group === scope);

  const scopes: { key: Scope; label: string; n: number }[] = [
    { key: 'all', label: 'Everything', n: pastTotal },
    { key: 'boards', label: 'Boards', n: boardsTotal },
    { key: 'weeks', label: 'Weeks', n: weeksTotal },
  ];

  // One block per month, in the order the items arrive (newest first).
  const months = useMemo(() => {
    const out: { month: string; items: HubItem[] }[] = [];
    for (const item of shown) {
      const month = monthOf(item.startDate);
      const last = out[out.length - 1];
      if (last && last.month === month) last.items.push(item);
      else out.push({ month, items: [item] });
    }
    return out;
  }, [shown]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex overflow-hidden rounded-lg border border-card-border text-xs font-semibold">
          {scopes.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setScope(s.key);
                setKinds(new Set());
              }}
              aria-pressed={scope === s.key}
              className={`px-3 py-1.5 transition-colors ${
                scope === s.key ? 'bg-gold text-brown-dark' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {s.label}
              <span className={`ml-1.5 ${scope === s.key ? 'text-brown-dark/70' : 'text-text-muted/70'}`}>{s.n}</span>
            </button>
          ))}
        </span>

        <span className="inline-flex flex-wrap gap-1.5">
          {chipKinds.map((k) => {
            const on = kinds.has(k.key);
            return (
              <button
                key={k.key}
                type="button"
                onClick={() =>
                  setKinds((prev) => {
                    const next = new Set(prev);
                    if (next.has(k.key)) next.delete(k.key);
                    else next.add(k.key);
                    return next;
                  })
                }
                aria-pressed={on}
                style={on ? { borderColor: k.accent, background: `color-mix(in srgb, ${k.accent} 14%, transparent)` } : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  on ? 'text-foreground' : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: k.accent }} />
                {k.short}
              </button>
            );
          })}
        </span>

        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or winner…"
          aria-label="Search the record"
          className="ml-auto min-w-[170px] flex-1 rounded-lg placeholder:text-text-muted focus:border-gold/50 sm:max-w-xs sm:flex-none"
        />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border py-12 text-center text-sm text-text-muted">
          {items.length === 0 ? 'Nothing has finished yet.' : 'Nothing matches that.'}
        </div>
      ) : (
        <div className="space-y-5">
          {months.map((m) => (
            <section key={m.month}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-gold">{m.month}</h3>
              <CompetitionRowList count={m.items.length}>
                {m.items.map((item) => (
                  <li key={item.key}>
                    <CompetitionRow row={recordRow(item)} dates={`${dateShort(item.startDate)} – ${dateShort(item.endDate)}`} />
                  </li>
                ))}
              </CompetitionRowList>
            </section>
          ))}
        </div>
      )}

      {showMoreHref && shown.length > 0 && (
        <div className="mt-4 text-center">
          <ClanLink
            href={showMoreHref}
            scroll={false}
            className="inline-block rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Show more
            <span className="ml-2 text-text-muted/70">
              {items.length} of {pastTotal} finished
            </span>
          </ClanLink>
        </div>
      )}
    </div>
  );
}
