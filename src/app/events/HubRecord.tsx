'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { HUB_KINDS, hubKind } from '@/lib/hubKinds';
import type { HubItem } from '@/lib/eventsHub';

/**
 * Everything the clan has run, boards and weeks in one list.
 *
 * A ledger rather than a wall of cards: one weekly a week is fifty-two lines a year and three a
 * week is over a hundred and fifty, which cards stop being able to hold somewhere around forty.
 * Grouped by month so the eye can find a period, and a repeated date blanks out so a week's three
 * competitions read as one block.
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

  // Month heads and repeated dates: each row reads the one before it rather than accumulating
  // into a variable, so nothing is reassigned while rendering.
  const rows = useMemo(
    () =>
      shown.map((item, idx) => {
        const prev = idx > 0 ? shown[idx - 1] : null;
        const month = monthOf(item.startDate);
        const startsMonth = !prev || monthOf(prev.startDate) !== month;
        const when = `${dateShort(item.startDate)} – ${dateShort(item.endDate)}`;
        // Three weeklies that share a week share a date; printing it three times is noise.
        const prevWhen = prev ? `${dateShort(prev.startDate)} – ${dateShort(prev.endDate)}` : '';
        const repeated = !startsMonth && when === prevWhen;
        return { item, month: startsMonth ? month : null, when: repeated ? '' : when };
      }),
    [shown],
  );

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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  on ? 'text-foreground' : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: k.accent }} />
                {k.short}
              </button>
            );
          })}
        </span>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or winner…"
          aria-label="Search the record"
          className="ml-auto min-w-[170px] flex-1 rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-gold/50 focus:outline-none sm:max-w-xs sm:flex-none"
        />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border py-12 text-center text-sm text-text-muted">
          {items.length === 0 ? 'Nothing has finished yet.' : 'Nothing matches that.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-2.5 pb-2 text-left font-bold">When</th>
                <th className="px-2.5 pb-2 text-left font-bold">What</th>
                <th className="px-2.5 pb-2 text-right font-bold">In</th>
                <th className="px-2.5 pb-2 text-left font-bold">Winner</th>
                <th className="px-2.5 pb-2 text-right font-bold">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, month, when }) => {
                const meta = hubKind(item.kind);
                return (
                  <Row key={item.key} item={item} accent={meta.accent} short={meta.short} when={when} month={month} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showMoreHref && shown.length > 0 && (
        <div className="mt-4 text-center">
          <Link
            href={showMoreHref}
            scroll={false}
            className="inline-block rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Show more
            <span className="ml-2 text-text-muted/70">
              {items.length} of {pastTotal} finished
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  accent,
  short,
  when,
  month,
}: {
  item: HubItem;
  accent: string;
  short: string;
  when: string;
  month: string | null;
}) {
  return (
    <>
      {month && (
        <tr>
          <td colSpan={5} className="px-2.5 pb-1.5 pt-5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold">
            {month}
          </td>
        </tr>
      )}
      <tr className="transition-colors hover:bg-brown-light/40">
        <td className="whitespace-nowrap border-t border-card-border/70 px-2.5 py-2 font-mono text-[11.5px] text-text-muted">
          {when}
        </td>
        <td className="border-t border-card-border/70 px-2.5 py-2">
          <Link href={item.href} className="flex items-center gap-2.5 hover:text-gold">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
            <span className="min-w-0">
              <span className="block text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
                {short}
              </span>
              <b className="block truncate font-bold">{item.name}</b>
            </span>
          </Link>
        </td>
        <td className="whitespace-nowrap border-t border-card-border/70 px-2.5 py-2 text-right font-mono text-text-muted">
          {item.entrants || '—'}
        </td>
        <td className="max-w-[180px] truncate border-t border-card-border/70 px-2.5 py-2">
          {item.top ? `🏆 ${item.top.name}` : <span className="text-text-muted">—</span>}
        </td>
        <td className="whitespace-nowrap border-t border-card-border/70 px-2.5 py-2 text-right font-mono font-bold text-gold-light">
          {item.top?.text ?? '—'}
        </td>
      </tr>
    </>
  );
}
