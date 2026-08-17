'use client';

import { useMemo, useState } from 'react';
import { itemIconUrl } from '@/lib/tileIcons';
import LocalTime from '@/components/LocalTime';
import type { BestTime, RecentUnlock } from '@/lib/clogProfile';
import { GROUP_ORDER, tierFor, type PageGroup, type ShowcaseItem, type ValuedItem } from '@/lib/clogRarity';
import { formatGp } from '@/lib/itemPrices';

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
  /** The rarest things they own, hardest first. The page opens on these. */
  showcase: ShowcaseItem[];
  /** The most valuable, by GE mid price × how many they have. Tradeables only. */
  valuable: ValuedItem[];
  /** What the whole log is worth, gp — the number the value view is really answering. */
  totalValue: number;
  /** Item id → 1-in-N, for the grid's rarity weighting. Only items with a meaningful rate. */
  rarityById: Record<number, number>;
  /** Page name → which shelf it belongs on, so 125 pages navigate as six groups. */
  groups: Record<string, PageGroup>;
  /** The page nearest to finished — the one thing that sends someone back to the game. */
  closest: { page: string; remaining: number } | null;
  /** Best times filed under the log page they belong to — every scale of a raid on its own page. */
  bestsByPage: Record<string, BestTime[]>;
  /** The same times as one flat list, for the searchable table. */
  bests: { activity: string; time: string }[];
}

export default function CollectionLog({
  rsn,
  synced,
  pages,
  catalogue,
  quantities,
  recent,
  bests,
  bestsByPage,
  showcase,
  valuable,
  totalValue,
  rarityById,
  groups,
  closest,
}: CollectionLogProps) {
  // Open on the fullest page — someone's log is most interesting where they've actually played.
  const initial = useMemo(() => {
    const withItems = [...pages].sort((a, b) => b.obtained - a.obtained || a.name.localeCompare(b.name));
    return withItems[0]?.name ?? pages[0]?.name ?? '';
  }, [pages]);
  const [selected, setSelected] = useState(initial);
  const [filter, setFilter] = useState('');
  const [bestFilter, setBestFilter] = useState('');
  const [show, setShow] = useState<'all' | 'owned' | 'missing'>('all');
  const [bestsOpen, setBestsOpen] = useState(false);
  // Rarity and value rank almost nothing the same, and people brag about both. One shelf, two ways
  // of reading it, rather than two stacked panels competing for the top of the page.
  const [shelf, setShelf] = useState<'rarest' | 'valuable'>('rarest');

  const page = pages.find((p) => p.name === selected) ?? pages[0];
  const owned = useMemo(() => new Set(page?.ownedIds ?? []), [page]);
  // Memoised because the grid filter depends on it: a fresh array literal each render would make
  // that recompute on every keystroke in the search box.
  const items = useMemo(() => catalogue[page?.name ?? ''] ?? [], [catalogue, page]);

  const shownBests = useMemo(() => {
    const q = bestFilter.trim().toLowerCase();
    return q ? bests.filter((b) => b.activity.toLowerCase().includes(q)) : bests;
  }, [bests, bestFilter]);

  const shownPages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? pages.filter((p) => p.name.toLowerCase().includes(q)) : pages;
  }, [pages, filter]);

  // Grouped navigation. Six named shelves beat one 125-row scroll, and the order runs from the
  // content people brag about to the miscellany.
  const grouped = useMemo(() => {
    const buckets = new Map<PageGroup, PageData[]>();
    for (const p of shownPages) {
      const group = groups[p.name] ?? 'Other';
      const list = buckets.get(group) ?? [];
      list.push(p);
      buckets.set(group, list);
    }
    return GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => {
      const list = buckets.get(g)!;
      return {
        group: g,
        pages: list,
        done: list.filter((p) => p.complete).length,
      };
    });
  }, [shownPages, groups]);

  const gridItems = useMemo(() => {
    if (show === 'owned') return items.filter((i) => owned.has(i.id));
    if (show === 'missing') return items.filter((i) => !owned.has(i.id));
    return items;
  }, [items, owned, show]);

  const pagesComplete = pages.filter((p) => p.complete).length;
  const pageBests = bestsByPage[page?.name ?? ''] ?? [];

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
      {/* The shelf. A log's meaning is its rarest slot, not the fraction of a list it fills, so the
          page opens on what was hard to get and puts the percentage beside it. */}
      {(showcase.length > 0 || valuable.length > 0) && (
        <div className="border border-gold/30 rounded-xl bg-gradient-to-b from-gold/[0.07] to-transparent p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            {/* A segmented control, not two words that happen to respond to clicks. The first
                version was styled like the heading beside it, so the value view may as well not
                have existed unless you thought to poke at the title. */}
            <div className="inline-flex rounded-lg border border-card-border overflow-hidden">
              {(['rarest', 'valuable'] as const).map((mode) => {
                const empty = mode === 'rarest' ? showcase.length === 0 : valuable.length === 0;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setShelf(mode)}
                    disabled={empty}
                    title={empty ? 'Nothing here yet' : undefined}
                    className={`px-3 py-1 text-xs font-medium transition-colors disabled:opacity-30 ${
                      shelf === mode
                        ? 'bg-gold/20 text-gold'
                        : 'text-text-muted hover:text-foreground hover:bg-card-bg-hover'
                    }`}
                  >
                    {mode === 'rarest' ? 'Rarest drops' : 'Most valuable'}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-text-muted">
              {shelf === 'rarest' ? (
                'by drop rate, not by effort'
              ) : (
                <>
                  <span className="font-mono text-gold">{formatGp(totalValue)}</span> of tradeables in this log
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            {shelf === 'rarest'
              ? showcase.map((item) => (
                  <div key={item.itemId} className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-14 h-14 rounded-lg border border-gold/50 bg-brown-dark/60 flex items-center justify-center shadow-[0_0_18px_-6px] shadow-gold/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={itemIconUrl(item.itemId)} alt="" className="w-10 h-10 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate max-w-[11rem]">{item.name}</div>
                      <div className="text-[11px] font-mono text-gold">
                        1 in {Math.round(item.denominator).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-text-muted truncate max-w-[11rem]">
                        {item.page}
                        {item.kcAtUnlock != null && <> · at {item.kcAtUnlock.toLocaleString()} KC</>}
                      </div>
                    </div>
                  </div>
                ))
              : valuable.map((item) => (
                  <div key={item.itemId} className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-14 h-14 rounded-lg border border-gold/50 bg-brown-dark/60 flex items-center justify-center shadow-[0_0_18px_-6px] shadow-gold/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={itemIconUrl(item.itemId)} alt="" className="w-10 h-10 object-contain" />
                      {item.quantity > 1 && (
                        <span className="absolute -top-1 -right-1 text-[9px] font-mono px-1 rounded bg-brown-dark border border-card-border text-gold">
                          {item.quantity}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate max-w-[11rem]">{item.name}</div>
                      <div className="text-[11px] font-mono text-gold">{formatGp(item.value)}</div>
                      <div className="text-[10px] text-text-muted truncate max-w-[11rem]">{item.page}</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* Header: the one number everybody wants, and how fresh it is. */}
      <div className="border border-card-border rounded-xl bg-card-bg p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <div className="text-2xl font-bold text-gold">
              {synced.obtained.toLocaleString()}
              <span className="text-text-muted text-base font-normal"> / {synced.total.toLocaleString()}</span>
            </div>
            <div className="text-xs text-text-muted">
              collection log slots · {pct}% · {pagesComplete} page{pagesComplete === 1 ? '' : 's'} finished
            </div>
            {closest && (
              <div className="text-xs text-accent-green-light mt-1">
                {closest.remaining} item{closest.remaining === 1 ? '' : 's'} from finishing {closest.page}
              </div>
            )}
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
            {grouped.map(({ group, pages: groupPages, done }) => (
              <div key={group}>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-1 bg-brown-dark/95 border-y border-card-border text-[10px] uppercase tracking-widest text-text-muted">
                  <span>{group}</span>
                  <span>
                    {done}/{groupPages.length}
                  </span>
                </div>
                {groupPages.map((p) => {
                  const active = p.name === page?.name;
                  return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setSelected(p.name)}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                    active ? 'bg-gold/15' : 'hover:bg-card-bg-hover'
                  }`}
                >
                  {/* A finished page is green, the way the game marks one — the count alone made you
                      compare two numbers to notice, which is exactly what green is for. */}
                  <span
                    className={`truncate ${
                      p.complete ? 'text-accent-green-light' : active ? 'text-gold' : ''
                    }`}
                  >
                    {p.name}
                  </span>
                  <span className={p.complete ? 'text-accent-green-light shrink-0' : 'text-text-muted shrink-0'}>
                    {p.obtained}/{p.total}
                  </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Items on the chosen page */}
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className={`font-semibold text-sm ${page?.complete ? 'text-accent-green-light' : ''}`}>
              {page?.name}
            </h3>
            <div className="flex items-center gap-2">
              {(['all', 'owned', 'missing'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setShow(mode)}
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border transition-colors ${
                    show === mode
                      ? 'border-gold/50 text-gold bg-gold/10'
                      : 'border-card-border text-text-muted hover:text-foreground'
                  }`}
                >
                  {mode}
                </button>
              ))}
              <span className={`text-xs ${page?.complete ? 'text-accent-green-light' : 'text-text-muted'}`}>
                {page?.obtained}/{page?.total}
              </span>
            </div>
          </div>
          {/* This page's times, every scale of it. A raid has one log page and many personal bests,
              so they belong here rather than only in a table somewhere else. */}
          {pageBests.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-3 border-b border-card-border">
              {(bestsOpen ? pageBests : pageBests.slice(0, 1)).map((b) => (
                <span
                  key={`${b.activity}-${b.label}`}
                  className="text-[11px] px-2 py-1 rounded border border-card-border bg-brown-dark/40"
                  title={b.activity}
                >
                  <span className="text-text-muted">{b.label}</span>{' '}
                  <span className="font-mono text-gold">{b.time}</span>
                </span>
              ))}
              {/* Twenty scales of a raid is a wall of chips. The headline time is the one anybody
                  quotes; the rest are there when you go looking for them. */}
              {pageBests.length > 1 && (
                <button
                  type="button"
                  onClick={() => setBestsOpen((open) => !open)}
                  className="text-[11px] px-2 py-1 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
                >
                  {bestsOpen ? 'Show less' : `+${pageBests.length - 1} more times`}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {gridItems.map((item) => {
              const has = owned.has(item.id);
              const qty = quantities[item.id] ?? 0;
              const denominator = rarityById[item.id];
              const tier = tierFor(denominator);
              // Rarity is worn only by what someone actually has: a missing megarare glowing on
              // every profile would say nothing about the person whose page this is.
              const emphasis = !has
                ? 'border-card-border/40 bg-black/30'
                : tier === 'ultra'
                  ? 'border-gold bg-gold/10 shadow-[0_0_16px_-4px] shadow-gold/70'
                  : tier === 'rare'
                    ? 'border-gold/70 bg-gold/[0.07]'
                    : tier === 'notable'
                      ? 'border-gold/40 bg-gold/5'
                      : 'border-card-border/80 bg-brown-dark/20';
              return (
                <div
                  key={item.id}
                  title={
                    (has ? `${item.name}${qty > 1 ? ` ×${qty}` : ''}` : `${item.name} — not obtained`) +
                    (denominator ? ` · 1 in ${Math.round(denominator).toLocaleString()}` : '')
                  }
                  className={`relative w-11 h-11 rounded border flex items-center justify-center ${emphasis}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={itemIconUrl(item.id)}
                    alt={item.name}
                    className={`w-8 h-8 object-contain ${has ? '' : 'opacity-[0.10] grayscale contrast-50'}`}
                  />
                  {has && qty > 1 && (
                    <span className="absolute -top-1 -right-1 text-[9px] font-mono px-1 rounded bg-brown-dark border border-card-border text-gold">
                      {qty > 999 ? `${Math.round(qty / 1000)}k` : qty}
                    </span>
                  )}
                </div>
              );
            })}
            {gridItems.length === 0 && (
              <p className="text-xs text-text-muted py-4">
                {show === 'owned' ? 'Nothing from this page yet.' : 'This page is finished.'}
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
