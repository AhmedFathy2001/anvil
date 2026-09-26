'use client';

import { useEffect, useMemo, useState } from 'react';

import { bestStyle, calculate, type Loadout } from '@/lib/dps/engine';
import { SLOTS } from '@/lib/dps/tables';
import { upgradeRoute } from '@/lib/dps/route';
import { monsterLabel, setupLoadout } from '@/lib/dps/summary';
import { tierOf, type GearBlock, type TierKey } from '@/lib/guideTiers';
import { formatGp } from '@/lib/itemPrices';
import LoadoutEditor, { ResultLine } from './LoadoutEditor';
import { ItemIcon } from './ItemPicker';
import { useGearData } from './useGearData';

const TIER_TONE: Record<TierKey, string> = {
  beginner: 'border-emerald-800/60 text-emerald-300',
  intermediate: 'border-amber-700/60 text-amber-300',
  advanced: 'border-red-800/60 text-red-300',
};

/**
 * A guide's gear progression, live: every setup's DPS against the monster, the reader's own gear
 * beside them, and the order to buy upgrades in. The numbers come from lib/dps — the same engine the
 * Discord summary used — so the site and the channel never disagree.
 */
export default function GearProgression({ block, tier, storageKey }: { block: GearBlock; tier: TierKey | 'all'; storageKey: string }) {
  const { idx, error } = useGearData();
  const monster = useMemo(() => (idx ? idx.monster(block.monster) : null), [idx, block.monster]);

  const results = useMemo(() => {
    if (!idx || !monster) return [];
    return block.setups.map((s) => ({ setup: s, r: bestStyle(setupLoadout(s), monster, idx.item, idx.rules)?.result ?? null }));
  }, [idx, monster, block.setups]);
  const top = Math.max(0.01, ...results.map((x) => x.r?.dps ?? 0));

  // The reader's own loadout. Starts as the first setup at the level they're reading; kept in this
  // browser so it survives a reload (a convenience only — nothing depends on it being there).
  const [mine, setMine] = useState<Loadout | null>(null);
  useEffect(() => {
    if (mine || !block.setups.length) return;
    let saved: Loadout | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw) as Loadout;
    } catch {
      /* storage unavailable */
    }
    const first = block.setups.find((s) => tier === 'all' || s.tier === tier) ?? block.setups[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from storage
    setMine(saved ?? setupLoadout(first));
  }, [block.setups, mine, storageKey, tier]);
  useEffect(() => {
    if (!mine) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(mine));
    } catch {
      /* storage unavailable */
    }
  }, [mine, storageKey]);

  const myResult = useMemo(() => (idx && monster && mine ? calculate(mine, monster, idx.item, idx.rules) : null), [idx, monster, mine]);

  // GE prices for everything the guide recommends — the upgrade route ranks by DPS per coin.
  const [prices, setPrices] = useState<Record<number, number> | null>(null);
  useEffect(() => {
    const ids = [...new Set(block.setups.flatMap((s) => Object.values(s.gear)))];
    if (!ids.length) return;
    let alive = true;
    fetch(`/api/gear/prices?ids=${ids.join(',')}`)
      .then((r) => (r.ok ? r.json() : { prices: {} }))
      .then((j) => alive && setPrices(j.prices ?? {}))
      .catch(() => alive && setPrices({}));
    return () => {
      alive = false;
    };
  }, [block.setups]);

  const route = useMemo(
    () => (idx && monster && mine && prices ? upgradeRoute(mine, block.setups, monster, idx.item, prices, 10, idx.rules) : null),
    [idx, monster, mine, prices, block.setups],
  );

  const [rsn, setRsn] = useState('');
  const [statsMsg, setStatsMsg] = useState<string | null>(null);
  async function loadStats() {
    if (!rsn.trim() || !mine) return;
    setStatsMsg('Looking up…');
    const res = await fetch(`/api/gear/stats?rsn=${encodeURIComponent(rsn.trim())}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setStatsMsg(j.error ?? 'Lookup failed');
    setMine({ ...mine, stats: { attack: j.stats.attack, strength: j.stats.strength, ranged: j.stats.ranged, magic: j.stats.magic } });
    setStatsMsg(`Loaded ${rsn.trim()}'s levels.`);
  }

  if (error) return <p className="my-4 text-sm text-red-300">{error}</p>;
  if (!idx) return <div className="my-4 h-40 animate-pulse rounded-xl border border-card-border bg-card-bg" />;
  if (!monster) return <p className="my-4 text-sm text-amber-200">Gear progression: unknown monster “{block.monster}”.</p>;

  const shown = results.filter((x) => tier === 'all' || x.setup.tier === tier);
  const mineDps = myResult?.dps ?? 0;
  const below = [...results].filter((x) => (x.r?.dps ?? 0) <= mineDps).sort((a, b) => (b.r?.dps ?? 0) - (a.r?.dps ?? 0))[0];

  return (
    <section className="my-6 rounded-xl border border-card-border bg-card-bg p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          Gear progression vs {monsterLabel(monster)}
        </h3>
        <span className="text-xs text-text-muted">
          {monster.hp} HP · Defence {monster.lv[0]}
          {monster.ew ? ` · weak to ${monster.ew} (${monster.ewp}%)` : ''}
        </span>
      </header>

      {/* The setups, with a DPS bar each — the reader's own shown against the same scale. */}
      <div className="space-y-2">
        {shown.map(({ setup, r }, i) => {
          const t = tierOf(setup.tier)!;
          return (
            <div key={i} className={`rounded-lg border bg-black/20 p-3 ${TIER_TONE[t.key].split(' ')[0]}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                  <span className={`mr-2 text-[11px] uppercase tracking-widest ${TIER_TONE[t.key].split(' ')[1]}`}>
                    {t.emoji} {t.label}
                  </span>
                  {setup.name}
                </div>
                <div className="text-xs text-text-muted">
                  <ResultLine r={r} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {SLOTS.filter((s) => setup.gear[s] != null).map((slot) => (
                  <ItemIcon key={slot} item={idx.item(setup.gear[slot])} size={30} fallback={slot} />
                ))}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gold/70" style={{ width: `${((r?.dps ?? 0) / top) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-text-muted">
                Levels {setup.stats.attack}/{setup.stats.strength}/{setup.stats.ranged}/{setup.stats.magic} (att/str/rng/mag)
                {setup.note ? ` · ${setup.note}` : ''}
              </p>
            </div>
          );
        })}
      </div>

      {/* The reader's own gear */}
      {mine && (
        <details className="group mt-4 rounded-lg border border-gold/30 bg-black/20" open>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm font-semibold text-gold">🧮 Your gear</span>
            <span className="text-xs text-text-muted">
              {myResult ? (
                <>
                  <span className="font-semibold text-foreground">{mineDps.toFixed(2)} DPS</span>
                  {below ? ` — at or above ${tierOf(below.setup.tier)?.label} “${below.setup.name}”` : ' — below every setup here'}
                </>
              ) : (
                'Pick your gear'
              )}
            </span>
          </summary>
          <div className="grid gap-4 border-t border-card-border p-3 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="block flex-1 text-[11px] text-text-muted">
                  Start from a setup
                  <select
                    className="w-full rounded border border-card-border bg-brown-dark px-2 py-1 text-xs"
                    value=""
                    onChange={(e) => {
                      const s = block.setups[Number(e.target.value)];
                      if (s) setMine({ ...setupLoadout(s), stats: mine.stats });
                    }}
                  >
                    <option value="">Copy a setup…</option>
                    {block.setups.map((s, i) => (
                      <option key={i} value={i}>
                        {tierOf(s.tier)?.label}: {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-1">
                  <label className="block text-[11px] text-text-muted">
                    Your RSN
                    <input
                      value={rsn}
                      onChange={(e) => setRsn(e.target.value)}
                      maxLength={12}
                      className="w-28 rounded border border-card-border bg-brown-dark px-2 py-1 text-xs"
                    />
                  </label>
                  <button onClick={loadStats} className="rounded border border-card-border px-2 py-1 text-xs hover:text-gold">
                    Load levels
                  </button>
                </div>
              </div>
              {statsMsg && <p className="text-[11px] text-text-muted">{statsMsg}</p>}
              <LoadoutEditor value={mine} onChange={setMine} idx={idx} monster={monster} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Upgrade route</h4>
              {!route ? (
                <p className="text-xs text-text-muted">Pricing upgrades…</p>
              ) : route.steps.length === 0 && route.untradeable.length === 0 ? (
                <p className="text-xs text-text-muted">Nothing in this guide beats what you have for this style. Nice.</p>
              ) : (
                <>
                  {route.steps.length > 0 && (
                    <ol className="space-y-1.5 text-xs">
                      {route.steps.map((s, i) => (
                        <li key={s.item.id} className="flex items-center gap-2">
                          <span className="w-4 text-right text-text-muted">{i + 1}.</span>
                          <ItemIcon item={s.item} size={24} />
                          <span className="min-w-0 flex-1 truncate">{s.item.n}</span>
                          <span className="text-emerald-300">+{s.gain.toFixed(2)}</span>
                          <span className="w-16 text-right text-text-muted">{s.price != null ? formatGp(s.price) : '—'}</span>
                          <span className="w-16 text-right">{s.dpsAfter.toFixed(2)}</span>
                        </li>
                      ))}
                      <li className="flex justify-end gap-2 border-t border-card-border pt-1 text-text-muted">
                        Total {formatGp(route.steps[route.steps.length - 1].totalCost)} → {route.steps[route.steps.length - 1].dpsAfter.toFixed(2)} DPS
                      </li>
                    </ol>
                  )}
                  {route.untradeable.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-[11px] uppercase tracking-widest text-text-muted">Not on the GE — earned or untradeable version</p>
                      <ul className="space-y-1 text-xs">
                        {route.untradeable.map((u) => (
                          <li key={u.item.id} className="flex items-center gap-2">
                            <ItemIcon item={u.item} size={22} />
                            <span className="min-w-0 flex-1 truncate">{u.item.n}</span>
                            <span className="text-emerald-300">+{u.gain.toFixed(2)} DPS</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-text-muted">
                    Ordered by DPS per coin, among the items this guide recommends for your style (measured with each loadout’s best stance). Prices from the Grand Exchange.
                  </p>
                </>
              )}
            </div>
          </div>
        </details>
      )}
      <p className="mt-2 text-[11px] text-text-muted">
        DPS from Anvil’s calculator, built on the OSRS Wiki’s combat formulas. Some special effects are approximated and say so. Ignores
        downtime, specs and boss mechanics.
      </p>
    </section>
  );
}


