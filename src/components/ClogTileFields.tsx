'use client';

import { useEffect, useMemo, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { clogTileSetupNote, type ClogTileMode } from '@/lib/clogTileWords';
import { CheckboxBox } from '@/components/Checkbox';
import { fuzzySearch } from '@/lib/fuzzySearch';
import { bossIconUrl, itemIconUrl } from '@/lib/tileIcons';
import ThingIcon from '@/components/ThingIcon';
import Switch from '@/components/Switch';
import { clogTickIds, clogTickState } from '@/lib/clogTickState';

// The collection-log tile's own fields in the tile editor (lib/clogTiles). Pages are a shortcut for
// picking items: adding a page ticks its uniques ("Uniques only", lib/clogMinor — bolt racks, raid
// kits and jewels stay unticked) or the whole page, untick any to leave it out, and items from
// several pages mix. The tile stores the item ids — so a page Jagex grows later never changes it.
// No pages and no items = any slot in the whole log (new-slots mode only).

interface PageItem {
  id: number;
  name: string;
  /** Not what a bingo means by a unique (lib/clogMinor): left unticked when the page is added. */
  minor?: boolean;
}

export interface ClogTileFieldsProps {
  /** The authoring API prefix (AuthoringApiContext) — /api/admin/clog lives under it. */
  lookupApi: string;
  mode: ClogTileMode;
  onMode: (m: ClogTileMode) => void;
  pages: string[];
  onPages: (pages: string[]) => void;
  itemIds: number[];
  onItemIds: (ids: number[]) => void;
  amount: string;
  onAmount: (v: string) => void;
  locked?: boolean;
}

export default function ClogTileFields(props: ClogTileFieldsProps) {
  const { lookupApi, mode, onMode, pages, onPages, itemIds, onItemIds, amount, onAmount, locked } = props;
  const [allPages, setAllPages] = useState<string[]>([]);
  const [pageItems, setPageItems] = useState<Record<string, PageItem[]>>({});
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const anyPage = mode === 'slots' && pages.length === 0 && itemIds.length === 0;

  useEffect(() => {
    let cancelled = false;
    clanFetch(`${lookupApi}/clog`)
      .then((r) => (r.ok ? r.json() : { activities: [] }))
      .then((d: { activities?: { name: string }[] }) => {
        if (!cancelled) setAllPages((d.activities ?? []).map((a) => a.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lookupApi]);

  // Each chosen page's items, fetched once.
  useEffect(() => {
    const missing = pages.filter((p) => !pageItems[p]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((p) =>
        clanFetch(`${lookupApi}/clog?activity=${encodeURIComponent(p)}`)
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .then((d: { items?: PageItem[] }) => [p, (d.items ?? []).map((i) => ({ id: i.id, name: i.name, minor: !!i.minor }))] as const),
      ),
    )
      .then((rows) => {
        if (!cancelled) setPageItems((prev) => ({ ...prev, ...Object.fromEntries(rows) }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pages, pageItems, lookupApi]);

  const chosen = useMemo(() => new Set(itemIds), [itemIds]);
  const f = filter.trim().toLowerCase();
  // Ranked and typo-tolerant (lib/fuzzySearch): "barows" still offers Barrows Chests.
  const matches = f ? fuzzySearch(allPages, f, pageName, { limit: 8, filter: (p) => !pages.includes(p) }) : [];

  async function addPage(page: string) {
    setFilter('');
    if (pages.includes(page)) return;
    let items = pageItems[page];
    if (!items) {
      const res = await clanFetch(`${lookupApi}/clog?activity=${encodeURIComponent(page)}`).catch(() => null);
      const d = res && res.ok ? ((await res.json()) as { items?: PageItem[] }) : { items: [] };
      items = (d.items ?? []).map((i) => ({ id: i.id, name: i.name, minor: !!i.minor }));
      setPageItems((prev) => ({ ...prev, [page]: items! }));
    }
    onPages([...pages, page]);
    // Its uniques on (the whole page when it has no minor slots): untick to exclude, tick to add.
    onItemIds([...new Set([...itemIds, ...clogTickIds(items, true)])]);
    setOpen(page);
  }

  function removePage(page: string) {
    const rest = pages.filter((p) => p !== page);
    const keep = new Set(rest.flatMap((p) => (pageItems[p] ?? []).map((i) => i.id)));
    const drop = new Set((pageItems[page] ?? []).map((i) => i.id));
    onPages(rest);
    onItemIds(itemIds.filter((id) => !drop.has(id) || keep.has(id)));
  }

  // The page's "Uniques only" switch: on = its uniques ticked, minor slots unticked; off = all of it.
  function setUniquesOnly(items: PageItem[], on: boolean) {
    const ids = new Set(items.map((i) => i.id));
    onItemIds([...itemIds.filter((id) => !ids.has(id)), ...clogTickIds(items, on)]);
  }

  function setGroup(items: PageItem[], on: boolean) {
    const ids = new Set(items.map((i) => i.id));
    onItemIds(on ? [...new Set([...itemIds, ...ids])] : itemIds.filter((id) => !ids.has(id)));
  }

  function toggle(id: number) {
    onItemIds(chosen.has(id) ? itemIds.filter((x) => x !== id) : [...itemIds, id]);
  }

  return (
    <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
      <div>
        <span className="block text-xs text-text-muted mb-1">What counts</span>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['slots', 'New log slots', 'First-time unlocks during the event'],
            ['complete', 'Finish pages / own items', 'Every chosen slot filled by the end — old ones count'],
          ] as const).map(([value, label, sub]) => (
            <button
              key={value}
              type="button"
              disabled={locked}
              onClick={() => onMode(value)}
              className={`min-h-11 text-left px-3 py-2 rounded border text-xs transition-colors disabled:opacity-50 ${
                mode === value ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
              }`}
            >
              <span className="block font-semibold">{label}</span>
              <span className="block opacity-80">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="clog-page-search" className="block text-xs text-text-muted mb-1">
          {mode === 'slots' ? 'From which pages or items' : 'Pages or items to own'}{' '}
          {anyPage && <span className="text-accent-green-light">— any page (add a page to narrow it)</span>}
        </label>
        <input
          id="clog-page-search"
          value={filter}
          disabled={locked}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Add a collection log page… (Barrows, Wintertodt, Zulrah)"
          className="w-full min-h-11 px-3 bg-brown-dark border border-card-border rounded text-sm focus:outline-none focus:border-gold disabled:opacity-50"
        />
        {matches.length > 0 && (
          <ul className="mt-1 rounded border border-card-border bg-card-bg divide-y divide-card-border">
            {matches.map((p) => (
              <li key={p}>
                <button type="button" onClick={() => addPage(p)} className="w-full min-h-10 text-left px-3 text-sm hover:bg-gold/10 flex items-center gap-2.5">
                  <ThingIcon src={bossIconUrl(p)} alt={p} />
                  {p}
                </button>
              </li>
            ))}
          </ul>
        )}

        {pages.map((page) => {
          const items = pageItems[page] ?? [];
          const on = items.filter((i) => chosen.has(i.id)).length;
          const tick = clogTickState(items, chosen);
          const minor = items.filter((i) => i.minor);
          const minorOn = minor.filter((i) => chosen.has(i.id)).length;
          const groups: [string, PageItem[]][] = minor.length > 0
            ? [['Uniques', items.filter((i) => !i.minor)], ['Also on this page — tick to count', minor]]
            : [['Items', items]];
          return (
            <div key={page} className="mt-2 rounded border border-card-border bg-brown-dark/40">
              <div className="flex items-center justify-between gap-2 px-3 min-h-10">
                <button type="button" onClick={() => setOpen(open === page ? null : page)} className="text-sm font-medium text-left flex-1 flex items-center gap-2">
                  <ThingIcon src={bossIconUrl(page)} alt={page} size={20} />
                  {page} <span className="text-xs text-text-muted">· {on}/{items.length} items</span>
                </button>
                <button type="button" disabled={locked} onClick={() => removePage(page)} className="text-xs text-red-400 hover:text-red-300" aria-label={`Remove ${page}`}>
                  Remove
                </button>
              </div>
              {minor.length > 0 && (
                <div className="px-3 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Switch
                    disabled={locked}
                    checked={tick === 'uniques'}
                    mixed={tick === 'custom'}
                    onChange={(next) => setUniquesOnly(items, next)}
                  >
                    Uniques only{tick === 'custom' && <span className="text-text-dim"> · custom picks</span>}
                  </Switch>
                  <span className="text-[11px] text-text-dim">
                    {tick === 'uniques'
                      ? `${minor.length} minor item${minor.length === 1 ? '' : 's'} left out (${minor[0].name}${minor.length > 1 ? '…' : ''})`
                      : tick === 'all'
                        ? `Whole page counts, ${minor[0].name}${minor.length > 1 ? ` and ${minor.length - 1} more minor item${minor.length === 2 ? '' : 's'}` : ''} too`
                        : minorOn > 0
                          ? `Ticked by hand · ${minorOn} minor item${minorOn === 1 ? '' : 's'} count${minorOn === 1 ? 's' : ''}`
                          : 'Ticked by hand'}
                  </span>
                </div>
              )}
              {open === page && (
                <div className="px-3 pb-2 space-y-2">
                  {groups.map(([title, list]) => (
                    <div key={title}>
                      <div className="flex gap-3 text-xs mb-1 items-center">
                        {groups.length > 1 && <span className="text-text-muted">{title}</span>}
                        <button type="button" disabled={locked} className="text-gold" onClick={() => setGroup(list, true)}>All</button>
                        <button type="button" disabled={locked} className="text-gold" onClick={() => setGroup(list, false)}>None</button>
                      </div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                        {list.map((it) => (
                          <li key={it.id}>
                            <label className="flex items-center gap-2 min-h-8 text-xs">
                              <CheckboxBox disabled={locked} checked={chosen.has(it.id)} onChange={() => toggle(it.id)} />
                              <ThingIcon src={itemIconUrl(it.id)} alt={it.name} size={20} />
                              <span className={chosen.has(it.id) ? '' : 'text-text-muted line-through'}>{it.name}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label htmlFor="clog-amount" className="block text-xs text-text-muted mb-1">
          {mode === 'slots' ? 'New slots needed' : `Pages needed${pages.length > 1 ? ` (blank = all ${pages.length})` : ''}`}
        </label>
        <input
          id="clog-amount"
          type="number"
          min={1}
          value={amount}
          disabled={locked || (mode === 'complete' && pages.length <= 1)}
          onChange={(e) => onAmount(e.target.value)}
          placeholder={mode === 'slots' ? 'e.g. 10' : 'all'}
          className="w-full min-h-11 px-3 bg-brown-dark border border-card-border rounded text-sm disabled:opacity-50"
        />
      </div>

      <p className="text-[11px] leading-relaxed text-amber-200/90 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1.5">
        {clogTileSetupNote(mode)}
      </p>
    </div>
  );
}

const pageName = (p: string) => p;
