'use client';

import ThingIcon from '@/components/ThingIcon';
import { itemIconUrl } from '@/lib/tileIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { howItCountsLine, itemTileConfig, type ItemHow, type ItemNeed } from '@/lib/tileCreatorConfig';
import type { TaskCandidate } from '@/lib/taskMatch';
import type { ItemObtainInfo } from '@/lib/itemObtain';
import { AmountField, ChoiceButton, CountsBanner, Eyebrow, PrimaryButton, StepHeader } from './parts';

interface Item {
  id: number;
  name: string;
}

/**
 * Items: pick them, then answer ONE question — do they land in the inventory (an item-gain tile) or
 * does a monster drop them (a drop tile)? The answer is pre-picked from the drop datasets; the admin
 * only changes it when we guessed wrong.
 */
export default function ItemStep({
  seed,
  amount: initialAmount,
  onBack,
  onNext,
}: {
  seed?: { items?: Item[]; how?: ItemHow };
  amount: number | null;
  onBack: () => void;
  onNext: (candidate: TaskCandidate) => void;
}) {
  const [items, setItems] = useState<Item[]>(seed?.items ?? []);
  const [info, setInfo] = useState<Record<number, ItemObtainInfo>>({});
  const [how, setHow] = useState<ItemHow | null>(seed?.how ?? null);
  const [howTouched, setHowTouched] = useState(false);
  const [need, setNeed] = useState<ItemNeed>(initialAmount && initialAmount > 1 ? 'total' : 'any');
  const [amount, setAmount] = useState<number | null>(initialAmount && initialAmount > 1 ? initialAmount : 10);
  const [sources, setSources] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Item[]>([]);
  // Loot only by default (lib/osrsItems isDroppableItem: drops, chest rewards, clog unlocks), so a
  // search for "masori" isn't a page of (l), (broken) and max-cape variants. A gain tile, or the
  // admin asking, searches every item.
  const [everyItem, setEveryItem] = useState(false);
  const seq = useRef(0);

  // What the datasets say about each picked item (how it's obtained, who drops it, its clog page).
  const missing = items.filter((i) => !info[i.id]).map((i) => i.id);
  const missingKey = missing.join(',');
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    clanFetch(`/api/admin/task-suggest/items?ids=${missingKey}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: ItemObtainInfo[] }) => {
        if (cancelled) return;
        setInfo((prev) => ({ ...prev, ...Object.fromEntries(d.items.map((i) => [i.id, i])) }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  // Pre-pick the likely answer until the admin answers themselves: mostly monster drops → drop.
  const known = useMemo(() => items.map((i) => info[i.id]).filter(Boolean) as ItemObtainInfo[], [items, info]);
  const likely: ItemHow | null = known.length === 0 ? null : known.filter((i) => i.monster).length * 2 > known.length ? 'drop' : 'gain';
  const effectiveHow: ItemHow = howTouched ? how ?? 'gain' : how ?? likely ?? 'gain';

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const mine = ++seq.current;
    const lootOnly = !everyItem && !(howTouched && how === 'gain');
    const t = setTimeout(async () => {
      try {
        const res = await clanFetch(`/api/admin/items-search?q=${encodeURIComponent(query)}${lootOnly ? '&dropsOnly=1' : ''}`);
        const data = res.ok ? ((await res.json()) as Item[]) : [];
        if (mine === seq.current) setHits(data.slice(0, 8));
      } catch {
        if (mine === seq.current) setHits([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, everyItem, how, howTouched]);

  const pages = useMemo(() => {
    const set = new Set(known.map((i) => i.clogPage).filter((p): p is string => !!p));
    return [...set].slice(0, 2);
  }, [known]);
  const allSources = useMemo(() => [...new Set(known.flatMap((i) => i.sources))].slice(0, 8), [known]);
  const hasPet = known.some((i) => i.pet);

  async function addPage(page: string) {
    const res = await clanFetch(`/api/admin/task-suggest/items?page=${encodeURIComponent(page)}`);
    if (!res.ok) return;
    const d = (await res.json()) as { items: Item[] };
    setItems((prev) => [...prev, ...d.items.filter((i) => !prev.some((p) => p.id === i.id))]);
  }

  const effectiveNeed: ItemNeed = need === 'each' && (effectiveHow === 'gain' || items.length < 2) ? 'any' : need;
  const config = itemTileConfig({ items, how: effectiveHow, need: effectiveNeed, amount, sources });
  const countsLine = config ? howItCountsLine(config) : null;

  function next() {
    if (!config || !countsLine) return;
    const one = items.length === 1 ? items[0].name : null;
    const what = one ?? `${items.length} items`;
    const n = effectiveNeed === 'total' ? Math.max(1, amount ?? 1) : 1;
    const title =
      effectiveNeed === 'each' ? `One of each: ${items.map((i) => i.name).join(', ')}`.slice(0, 120)
      : n > 1 ? `${n.toLocaleString('en-US')} × ${what}`
      : one ? one : `Any of ${items.map((i) => i.name).join(', ')}`.slice(0, 120);
    onNext({
      key: `items-${items.map((i) => i.id).join('+')}`,
      source: effectiveHow === 'gain' ? 'gain' : 'drop',
      badge: effectiveHow === 'gain' ? 'Items' : 'Drop',
      title,
      titleTemplate: effectiveNeed === 'total' ? `{n} × ${what}` : title,
      titleOne: one ?? undefined,
      hint: countsLine.text,
      engine: countsLine.engine,
      verb: 'Get',
      noun: effectiveNeed === 'each' ? 'of each item' : what,
      amountField: effectiveNeed === 'total' ? 'requiredAmount' : null,
      amount: effectiveNeed === 'total' ? n : null,
      config,
      flow: 'items',
      seed: { items, how: effectiveHow },
      category: 'items',
      score: 0,
      confident: true,
    });
  }

  return (
    <div>
      <StepHeader title="Get items" onBack={onBack} />

      <Eyebrow id="items-label">Which items</Eyebrow>
      <div className="rounded-xl border border-card-border bg-brown-dark/40 p-2 mb-2">
        <ul aria-labelledby="items-label" className="flex flex-wrap gap-1.5 mb-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 pl-1.5 pr-1 text-sm">
              <ThingIcon src={itemIconUrl(it.id)} alt={it.name} size={22} />
              <span>{it.name}</span>
              {info[it.id]?.pet && <span className="text-[10px] font-semibold text-gold">PET</span>}
              <button
                type="button"
                aria-label={`Remove ${it.name}`}
                onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                className="w-11 h-11 -my-2 grid place-items-center text-text-muted hover:text-foreground"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="relative">
          <input
            aria-label="Add an item"
            placeholder="Add an item…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full min-h-11 px-3 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold"
          />
          {q.trim().length >= 2 && (hits.length > 0 || !everyItem && !(howTouched && how === 'gain')) && (
            <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-card-border bg-brown-dark divide-y divide-card-border/60 shadow-xl">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((prev) => (prev.some((p) => p.id === h.id) ? prev : [...prev, h]));
                      setQ('');
                      setHits([]);
                    }}
                    className="w-full min-h-11 text-left px-3 text-sm hover:bg-gold/10 flex items-center gap-2.5"
                  >
                    <ThingIcon src={itemIconUrl(h.id)} alt={h.name} />
                    {h.name}
                  </button>
                </li>
              ))}
              {!everyItem && !(howTouched && how === 'gain') && (
                <li>
                  <button type="button" onClick={() => setEveryItem(true)} className="w-full min-h-11 text-left px-3 text-sm text-gold hover:bg-gold/10">
                    {hits.length ? 'Not here? Search every item' : 'No loot by that name. Search every item'}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
      {pages.map((p) => (
        <button key={p} type="button" onClick={() => addPage(p)} className="min-h-11 text-sm text-gold hover:text-gold-light underline underline-offset-2 mr-4">
          + All {p} collection log items
        </button>
      ))}

      <fieldset className="mt-5 mb-5">
        <legend className="text-sm font-semibold text-foreground/90 mb-2.5">How do players get them?</legend>
        <div className="space-y-2">
          <ChoiceButton pressed={effectiveHow === 'gain'} onClick={() => { setHow('gain'); setHowTouched(true); }} className="w-full text-left flex flex-col items-start">
            <span className="font-medium">They land in the inventory</span>
            <span className="text-xs text-text-muted">Rewards, gathering, minigames. Duplicates count. Banking and trades never do.</span>
          </ChoiceButton>
          <ChoiceButton pressed={effectiveHow === 'drop'} onClick={() => { setHow('drop'); setHowTouched(true); }} className="w-full text-left flex flex-col items-start">
            <span className="font-medium">A monster drops them</span>
            <span className="text-xs text-text-muted">Pick which monsters count, or leave it open. Each drop gets a screenshot.</span>
          </ChoiceButton>
        </div>
        {!howTouched && likely && (
          <p className="mt-2 text-xs text-text-muted">
            We picked this for you:{' '}
            {likely === 'drop' ? 'these come off a monster’s drop table.' : 'these come from rewards, gathering or minigames, not a monster’s drop table.'}
          </p>
        )}
      </fieldset>

      {effectiveHow === 'drop' && allSources.length > 0 && (
        <fieldset className="mb-5">
          <legend className="text-sm font-semibold text-foreground/90 mb-2.5">Only from (optional — none ticked means any monster)</legend>
          <div className="flex flex-wrap gap-2">
            {allSources.map((s) => {
              const on = sources.includes(s);
              return (
                <ChoiceButton key={s} pressed={on} onClick={() => setSources((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))} className="text-xs">
                  {s}
                </ChoiceButton>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="mb-5">
        <legend className="text-sm font-semibold text-foreground/90 mb-2.5">Players must get</legend>
        <div className="grid grid-cols-3 gap-2">
          <ChoiceButton pressed={effectiveNeed === 'any'} onClick={() => setNeed('any')}>Any 1</ChoiceButton>
          <ChoiceButton pressed={effectiveNeed === 'total'} onClick={() => setNeed('total')}>N in total</ChoiceButton>
          <ChoiceButton
            pressed={effectiveNeed === 'each'}
            onClick={() => setNeed('each')}
            disabled={effectiveHow === 'gain' || items.length < 2}
            title={effectiveHow === 'gain' ? 'One of each is a set, which only “A monster drops them” can track.' : items.length < 2 ? 'Add a second item first.' : undefined}
          >
            One of each
          </ChoiceButton>
        </div>
        {effectiveNeed === 'total' && (
          <div className="mt-3 flex items-center gap-2 text-base">
            <span>Get</span>
            <AmountField value={amount} onChange={setAmount} label="How many in total" />
            <span>in total{items.length > 1 ? ', any mix' : ''}</span>
          </div>
        )}
      </fieldset>

      {countsLine && (
        <CountsBanner
          engine={countsLine.engine}
          text={countsLine.text}
          extra={hasPet && effectiveHow === 'drop' ? ' The pet counts too, duplicates included.' : null}
        />
      )}

      <div className="mt-6 flex justify-end">
        <PrimaryButton onClick={next} disabled={!config}>
          Next: points
        </PrimaryButton>
      </div>
    </div>
  );
}
