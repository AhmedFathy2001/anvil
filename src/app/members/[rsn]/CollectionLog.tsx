'use client';

import { useMemo, useState } from 'react';
import { itemIconUrl } from '@/lib/tileIcons';
import LocalTime from '@/components/LocalTime';
import type { ClogPageView, RecentUnlock } from '@/lib/clogProfile';

// A member's synced collection log. The game's own shape — pages down the side, the chosen page's
// items in a grid, obtained lit and the rest dimmed — because that is the only layout anyone will
// recognise, and a table of item names would be unreadable at 1,700 rows.
//
// Everything here is derived from the catalogue, so a page a member has never touched still renders
// with its real contents, all dim. That is the honest picture: "0/38", not an absence.

interface PageData {
  name: string;
  obtained: number;
  total: number;
  ownedIds: number[];
  complete: boolean;
}

export interface CollectionLogProps {
  rsn: string;
  synced: {
    obtained: number;
    total: number;
    pagesSynced: number;
    pagesTotal: number;
    at: string | null;
    pluginVersion: string | null;
  } | null;
  pages: PageData[];
  /** Every page's item list, keyed by page name — the catalogue, shipped once for the client grid. */
  catalogue: Record<string, { id: number; name: string }[]>;
  quantities: Record<number, number>;
  recent: RecentUnlock[];
  /** Best times, already formatted, newest-first by activity name. */
  bests: { activity: string; time: string }[];
}

export default function CollectionLog({ rsn, synced, pages, catalogue, quantities, recent, bests }: CollectionLogProps) {
  // Open on the fullest page — someone's log is most interesting where they've actually played.
  const initial = useMemo(() => {
    const withItems = [...pages].sort((a, b) => b.obtained - a.obtained || a.name.localeCompare(b.name));
    return withItems[0]?.name ?? pages[0]?.name ?? '';
  }, [pages]);
  const [selected, setSelected] = useState(initial);
  const [filter, setFilter] = useState('');

  const page = pages.find((p) => p.name === selected) ?? pages[0];
  const owned = useMemo(() => new Set(page?.ownedIds ?? []), [page]);
  const items = catalogue[page?.name ?? ''] ?? [];

  const shownPages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? pages.filter((p) => p.name.toLowerCase().includes(q)) : pages;
  }, [pages, filter]);

  if (!synced) {
    return (
      <div className="border border-dashed border-card-border rounded-xl p-8 text-center">
        <p className="text-sm text-text-muted">
          {rsn} hasn&rsquo;t synced a collection log yet.
        </p>
        <p className="text-xs text-text-muted/70 mt-2">
          In RuneLite: open the Anvil tab in the collection log and press <span className="text-gold">Sync profile</span>,
          then open your collection log. The whole thing uploads in one go.
        </p>
      </div>
    );
  }

  const pct = synced.total > 0 ? Math.round((synced.obtained / synced.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header: the one number everybody wants, and how fresh it is. */}
      <div className="border border-card-border rounded-xl bg-card-bg p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <div className="text-2xl font-bold text-gold">
              {synced.obtained.toLocaleString()}
              <span className="text-text-muted text-base font-normal"> / {synced.total.toLocaleString()}</span>
            </div>
            <div className="text-xs text-text-muted">collection log slots · {pct}%</div>
          </div>
          <div className="text-xs text-text-muted text-right">
            {synced.at && (
              <div>
                Synced <LocalTime date={synced.at} />
              </div>
            )}
            {synced.pagesSynced < synced.pagesTotal && (
              <div className="text-yellow-300/80">
                {synced.pagesSynced}/{synced.pagesTotal} pages seen — open the log to fill the rest
              </div>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-brown-dark overflow-hidden">
          <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-gold rounded-full" />
            Recent unlocks
          </h3>
          <div className="flex flex-wrap gap-2">
            {recent.map((u) => (
              <div
                key={`${u.itemId}-${u.at}`}
                className="flex items-center gap-2 border border-card-border rounded-lg bg-card-bg px-2.5 py-1.5"
                title={`${u.name} — ${u.pageName}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemIconUrl(u.itemId)} alt="" className="w-6 h-6 object-contain" />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate max-w-[12rem]">{u.name}</div>
                  <div className="text-[10px] text-text-muted">
                    <LocalTime date={u.at} format="date" />
                    {u.kcAtUnlock != null && <> · at {u.kcAtUnlock.toLocaleString()} KC</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        {/* Pages */}
        <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
          <div className="p-2 border-b border-card-border">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a page…"
              className="w-full px-2 py-1.5 bg-brown-dark border border-card-border rounded text-xs focus:outline-none focus:border-gold"
            />
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {shownPages.map((p) => {
              const active = p.name === page?.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setSelected(p.name)}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                    active ? 'bg-gold/15 text-gold' : 'hover:bg-card-bg-hover'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className={p.complete ? 'text-accent-green-light shrink-0' : 'text-text-muted shrink-0'}>
                    {p.obtained}/{p.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Items on the chosen page */}
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold text-sm">{page?.name}</h3>
            <span className={`text-xs ${page?.complete ? 'text-accent-green-light' : 'text-text-muted'}`}>
              {page?.obtained}/{page?.total}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => {
              const has = owned.has(item.id);
              const qty = quantities[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  title={has ? `${item.name}${qty > 1 ? ` ×${qty}` : ''}` : `${item.name} — not obtained`}
                  className={`relative w-11 h-11 rounded border flex items-center justify-center ${
                    has ? 'border-gold/40 bg-gold/5' : 'border-card-border bg-brown-dark/40'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={itemIconUrl(item.id)}
                    alt={item.name}
                    className={`w-8 h-8 object-contain ${has ? '' : 'opacity-20 grayscale'}`}
                  />
                  {has && qty > 1 && (
                    <span className="absolute -top-1 -right-1 text-[9px] font-mono px-1 rounded bg-brown-dark border border-card-border text-gold">
                      {qty > 999 ? `${Math.round(qty / 1000)}k` : qty}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {bests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-gold rounded-full" />
            Personal bests
          </h3>
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border max-h-72 overflow-y-auto">
            {bests.map((b) => (
              <div key={b.activity} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                <span className="truncate">{b.activity}</span>
                <span className="font-mono text-gold shrink-0">{b.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
