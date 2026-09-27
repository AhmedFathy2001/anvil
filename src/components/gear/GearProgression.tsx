'use client';

import { useEffect, useMemo, useState } from 'react';

import { bestStyle, calculate, type DpsResult, type Loadout } from '@/lib/dps/engine';
import { upgradeRoute } from '@/lib/dps/route';
import { monsterLabel, setupLoadout } from '@/lib/dps/summary';
import { TIERS, blockTargets, setupTargets, tierOf, type GearBlock, type GearSetup, type TierKey } from '@/lib/guideTiers';
import { encounter } from '@/lib/dps/encounter';
import { monsterKey as monsterKeyOf, type GearIndex } from '@/lib/dps/summary';
import type { Monster } from '@/lib/dps/engine';
import { formatGp } from '@/lib/itemPrices';
import LoadoutEditor from './LoadoutEditor';
import EquipmentPanel from './EquipmentPanel';
import { ItemIcon } from './ItemIcon';
import InventoryPanel, { useItemNames, type ItemNames } from './InventoryPanel';
import { bankTagString, inventorySetupJson } from '@/lib/runeliteExport';
import { useGearData } from './useGearData';
import Select from '@/components/Select';

const TIER_TONE: Record<TierKey, { border: string; text: string; bar: string }> = {
  beginner: { border: 'border-emerald-800/60', text: 'text-emerald-300', bar: 'bg-emerald-500/70' },
  intermediate: { border: 'border-amber-700/60', text: 'text-amber-300', bar: 'bg-amber-400/70' },
  advanced: { border: 'border-red-800/60', text: 'text-red-300', bar: 'bg-red-500/70' },
};

interface MySetup {
  name: string;
  loadout: Loadout;
}
interface Saved {
  setups: MySetup[];
  active: number;
}
interface MyAccount {
  rsn: string;
  stats: Loadout['stats'] | null;
}

const fmtTime = (sec: number) => (Number.isFinite(sec) ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '—');
const killTime = (r: DpsResult | null) => fmtTime(r?.ttk ?? Infinity);

/** Your saved setups for this guide's monster — this browser only, a convenience. */
function readSaved(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const j = JSON.parse(raw) as Saved;
    return Array.isArray(j.setups) && j.setups.length ? j : null;
  } catch {
    return null;
  }
}

/**
 * A guide's gear progression, live. The guide's setups for each level with their numbers; your own
 * setups beside them (as many as you like, compared in one table with the guide's budget → max); and
 * the order to buy upgrades in. Every number comes from lib/dps — the engine the Discord summary uses.
 */
export default function GearProgression({ block, tier, storageKey }: { block: GearBlock; tier: TierKey | 'all'; storageKey: string }) {
  const { idx, error } = useGearData();
  // Every target (the Barrows brothers, a raid's bosses) — one for most fights.
  const monsters = useMemo(
    () => (idx ? blockTargets(block).map((k) => idx.monster(k)).filter((m): m is Monster => !!m) : []),
    [idx, block],
  );
  const monster = monsters[0] ?? null;
  const multi = monsters.length > 1;
  const [viewTarget, setViewTarget] = useState(0);
  const shownTarget = monsters[Math.min(viewTarget, monsters.length - 1)] ?? null;
  const targetIndex = (k: string) => blockTargets(block).indexOf(k);
  const key = `${storageKey}:v2`;

  const guideResults = useMemo(() => {
    if (!idx || !monster) return [];
    return block.setups.map((s) => {
      const mine = monsters.filter((m) => setupTargets(s, block).includes(monsterKeyOf(m)));
      const perTarget = mine.map((m) => ({ m, r: bestStyle(setupLoadout(s), m, idx.item, idx.rules)?.result ?? null }));
      return { setup: s, r: perTarget[0]?.r ?? null, perTarget };
    });
  }, [idx, monster, monsters, block]);

  // A level's setups together, each target taken with the best one for it — the whole run.
  const tierRuns = useMemo(() => {
    if (!idx || !multi) return [];
    return TIERS.map((t, ti) => {
      const own = block.setups.filter((x) => x.tier === t.key);
      if (!own.length) return null;
      // A target this level has no setup for is done the way an earlier level does it, so the run
      // still has a time (a Barrows "max" block that only lists the melee-brother upgrade, say).
      const covered = new Set(own.flatMap((x) => setupTargets(x, block)));
      const earlier = TIERS.slice(0, ti).map((e) => e.key);
      const fill = block.setups
        .filter((x) => earlier.includes(x.tier))
        .map((x) => ({ setup: x, targets: setupTargets(x, block).filter((n) => !covered.has(n)) }))
        .filter((x) => x.targets.length);
      const parts = [...own.map((x) => ({ setup: x, targets: setupTargets(x, block) })), ...fill];
      return {
        tier: t.key,
        run: encounter(
          parts.map((x) => ({ loadout: setupLoadout(x.setup), targets: x.targets.map(targetIndex) })),
          monsters,
          idx.item,
          idx.rules,
        ),
        setups: parts.map((x) => x.setup),
        own: own.length,
      };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targetIndex derives from block
  }, [idx, multi, block, monsters]);

  // ── Your setups ──────────────────────────────────────────────────────────────────────────
  const [saved, setSaved] = useState<Saved | null>(null);
  useEffect(() => {
    if (saved || !block.setups.length) return;
    const first = block.setups.find((s) => tier === 'all' || s.tier === tier) ?? block.setups[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from storage
    setSaved(readSaved(key) ?? { setups: [{ name: 'My setup', loadout: setupLoadout(first) }], active: 0 });
  }, [block.setups, key, saved, tier]);
  useEffect(() => {
    if (!saved) return;
    try {
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      /* storage unavailable */
    }
  }, [saved, key]);

  const active = saved ? Math.min(saved.active, saved.setups.length - 1) : 0;
  const mine = saved?.setups[active]?.loadout ?? null;
  const updateMine = (loadout: Loadout) =>
    setSaved((s) => (s ? { ...s, setups: s.setups.map((x, i) => (i === active ? { ...x, loadout } : x)) } : s));
  const addSetup = (name: string, loadout: Loadout) =>
    setSaved((s) => (s ? { setups: [...s.setups, { name, loadout }].slice(0, 8), active: Math.min(s.setups.length, 7) } : s));
  const removeSetup = (i: number) =>
    setSaved((s) => (s && s.setups.length > 1 ? { setups: s.setups.filter((_, j) => j !== i), active: Math.max(0, s.active - (i <= s.active ? 1 : 0)) } : s));
  const renameSetup = (i: number) => {
    const name = window.prompt('Name this setup', saved?.setups[i]?.name ?? '');
    if (name?.trim()) setSaved((s) => (s ? { ...s, setups: s.setups.map((x, j) => (j === i ? { ...x, name: name.trim().slice(0, 30) } : x)) } : s));
  };
  /** Levels belong to the player, not the setup: apply them to every setup. */
  const setAllStats = (stats: Loadout['stats']) =>
    setSaved((s) => (s ? { ...s, setups: s.setups.map((x) => ({ ...x, loadout: { ...x.loadout, stats } })) } : s));

  const myResults = useMemo(
    () => (idx && monster && saved ? saved.setups.map((x) => calculate(x.loadout, monster, idx.item, idx.rules)) : []),
    [idx, monster, saved],
  );
  // Over the whole run, for fights with several targets: one setup used against all of them.
  const myRuns = useMemo(
    () => (idx && multi && saved ? saved.setups.map((x) => encounter([{ loadout: x.loadout }], monsters, idx.item, idx.rules)) : []),
    [idx, multi, monsters, saved],
  );

  // ── Levels: your own characters first, else any RSN ──────────────────────────────────────
  const [accounts, setAccounts] = useState<MyAccount[]>([]);
  useEffect(() => {
    let alive = true;
    fetch('/api/gear/my-accounts')
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((j) => alive && setAccounts(j.accounts ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [otherRsn, setOtherRsn] = useState<string | null>(null);
  const [statsMsg, setStatsMsg] = useState<string | null>(null);
  async function loadFromHiscores(name: string) {
    if (!name.trim()) return;
    setStatsMsg('Looking up…');
    const res = await fetch(`/api/gear/stats?rsn=${encodeURIComponent(name.trim())}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setStatsMsg(j.error ?? 'Lookup failed');
    setAllStats({ attack: j.stats.attack, strength: j.stats.strength, ranged: j.stats.ranged, magic: j.stats.magic });
    setStatsMsg(`Using ${name.trim()}'s levels.`);
  }
  function pickAccount(value: string) {
    if (value === '__other') return setOtherRsn('');
    const acc = accounts.find((a) => a.rsn === value);
    if (!acc) return;
    setOtherRsn(null);
    if (acc.stats) {
      setAllStats(acc.stats);
      setStatsMsg(`Using ${acc.rsn}'s levels.`);
    } else void loadFromHiscores(acc.rsn);
  }

  // ── Prices + route for the active setup ──────────────────────────────────────────────────
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
    () => (idx && monster && mine && prices ? upgradeRoute(mine, block.setups, monsters, idx.item, prices, 10, idx.rules) : null),
    [idx, monster, monsters, mine, prices, block.setups],
  );

  // ── Compare: the guide's budget → max setups and yours, one table ────────────────────────
  const [withGuide, setWithGuide] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 5000);
    return () => clearTimeout(t);
  }, [copied]);
  const itemNames = useItemNames(block.setups.flatMap((x) => [...(x.inventory ?? []), ...(x.runePouch ?? [])].map((it) => it?.id ?? 0).filter(Boolean)));
  type Row = { label: string; sub: string; dps: number; maxHit?: number; acc?: number; time: number; tone?: TierKey; mine?: number };
  const compareRows = useMemo(() => {
    const rows: Row[] = [];
    const fromResult = (r: DpsResult | null) => ({ dps: r?.dps ?? 0, maxHit: r?.maxHit, acc: r?.accuracy, time: r?.ttk ?? Infinity });
    if (withGuide) {
      if (multi) for (const tr of tierRuns) rows.push({ label: `${tierOf(tr.tier)!.label} setups`, sub: `${tr.own} setup${tr.own === 1 ? '' : 's'}${tr.setups.length > tr.own ? ' + earlier levels' : ''}, best per target`, dps: tr.run.dps, time: tr.run.time, tone: tr.tier });
      else for (const g of guideResults) rows.push({ label: g.setup.name, sub: tierOf(g.setup.tier)!.label, ...fromResult(g.r), tone: g.setup.tier });
    }
    saved?.setups.forEach((s, i) =>
      rows.push(multi ? { label: s.name, sub: 'Yours, on every target', dps: myRuns[i]?.dps ?? 0, time: myRuns[i]?.time ?? Infinity, mine: i } : { label: s.name, sub: 'Yours', ...fromResult(myResults[i] ?? null), mine: i }),
    );
    return rows.sort((a, b) => b.dps - a.dps);
  }, [withGuide, multi, tierRuns, guideResults, saved, myResults, myRuns]);
  const bestDps = Math.max(0.01, ...compareRows.map((r) => r.dps));

  if (error) return <p className="my-4 text-sm text-red-300">{error}</p>;
  if (!idx) return <div className="my-6 h-64 animate-pulse rounded-xl border border-card-border bg-card-bg" />;
  if (!monster) return <p className="my-4 text-sm text-amber-200">Gear progression: unknown monster “{block.monster}”.</p>;

  const shownGuide = guideResults.filter((g) => tier === 'all' || g.setup.tier === tier);
  async function copyExport(setup: GearSetup, kind: 'banktag' | 'setup') {
    const name = `${monster?.n ?? 'Anvil'} ${tierOf(setup.tier)?.label ?? ''} ${setup.name}`.trim();
    const ex = { name, gear: setup.gear, inventory: setup.inventory, runePouch: setup.runePouch, spellbook: setup.spellbook, notes: setup.note };
    const text = kind === 'banktag' ? bankTagString(ex) : inventorySetupJson(ex);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind === 'banktag' ? 'Bank tag copied — in the bank, right-click the + tab → Import tag tab.' : 'Copied — in the Inventory Setups panel, choose Import setup.');
    } catch {
      window.prompt('Copy this:', text);
    }
  }
  const copyToMine = (s: GearSetup) => addSetup(s.name, { ...setupLoadout(s), stats: mine?.stats ?? s.stats });

  return (
    <section className="@container my-6 space-y-5 rounded-2xl border border-card-border bg-gradient-to-b from-card-bg to-black/20 p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          Gear progression vs {multi ? monsters.map(shortName).join(', ') : monsterLabel(monster)}
        </h3>
        <span className="text-xs text-text-muted">
          {multi ? `${monsters.length} targets · ${monsters.reduce((a, m) => a + m.hp, 0)} HP in all` : `${monster.hp} HP · Defence ${monster.lv[0]}`}
          {!multi && monster.ew ? ` · weak to ${monster.ew} (${monster.ewp}%)` : ''}
        </span>
      </header>

      {/* The guide's setups, budget → max. A multi-target fight groups them by level, with the
          level's whole run on top (targets a level has no setup for borrow an earlier level's). */}
      {multi ? (
        <div className="space-y-4">
          {tierRuns
            .filter((tr) => tier === 'all' || tr.tier === tier)
            .map((tr) => {
              const tone = TIER_TONE[tr.tier];
              const borrowed = tr.run.targets
                .map((t, i) => ({ t, m: monsters[i] }))
                .filter(({ t }) => t.setup != null && tr.setups[t.setup].tier !== tr.tier);
              const missing = tr.run.targets.filter((t) => t.setup == null).length;
              return (
                <div key={tr.tier} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-card-border/60 pb-1.5">
                    <span className={`text-xs font-semibold uppercase tracking-widest ${tone.text}`}>
                      {tierOf(tr.tier)?.emoji} {tierOf(tr.tier)?.label}
                    </span>
                    <span className="text-xs text-text-muted">
                      Full run <span className="text-sm font-bold text-gold">{fmtTime(tr.run.time)}</span>
                      {Number.isFinite(tr.run.time) && <> · {tr.run.dps.toFixed(2)} DPS</>}
                      {missing > 0 && <span className="text-amber-200/80"> · {missing} target{missing === 1 ? '' : 's'} without a setup</span>}
                    </span>
                    {borrowed.length > 0 && (
                      <span className="w-full text-[11px] text-text-muted">
                        {borrowed.map(({ t, m }) => `${shortName(m)} with ${tr.setups[t.setup!].name} (${tierOf(tr.setups[t.setup!].tier)?.label})`).join(' · ')}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 @xl:grid-cols-2">
                    {guideResults
                      .filter((g) => g.setup.tier === tr.tier)
                      .map((g, i) => (
                        <SetupCard key={i} {...g} multi everyTarget={g.perTarget.length === monsters.length} idx={idx} names={itemNames} onExport={copyExport} onUse={copyToMine} />
                      ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className={`grid gap-3 ${shownGuide.length > 1 ? '@xl:grid-cols-2 @3xl:grid-cols-3' : ''}`}>
          {shownGuide.map((g, i) => (
            <SetupCard key={i} {...g} multi={false} everyTarget idx={idx} names={itemNames} onExport={copyExport} onUse={copyToMine} />
          ))}
        </div>
      )}

      {/* Your setups */}
      {saved && mine && (
        <div className="rounded-xl border border-gold/30 bg-black/20">
          <div className="flex flex-wrap items-center gap-2 border-b border-card-border px-3 py-2">
            <span className="mr-1 text-sm font-semibold text-gold">🧮 Your setups</span>
            {saved.setups.map((s, i) => (
              <span key={i} className={`flex items-center rounded-md border text-xs ${i === active ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted'}`}>
                <button type="button" onClick={() => setSaved({ ...saved, active: i })} onDoubleClick={() => renameSetup(i)} className="px-2 py-1" title="Double-click to rename">
                  {s.name}
                </button>
                {saved.setups.length > 1 && (
                  <button type="button" onClick={() => removeSetup(i)} className="pr-1.5 opacity-50 hover:text-red-300 hover:opacity-100" aria-label={`Remove ${s.name}`}>
                    ×
                  </button>
                )}
              </span>
            ))}
            {saved.setups.length < 8 && (
              <button type="button" onClick={() => addSetup(`Setup ${saved.setups.length + 1}`, { ...mine })} className="rounded-md border border-dashed border-card-border px-2 py-1 text-xs text-text-muted hover:text-gold">
                + Duplicate
              </button>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-text-muted">Levels from</span>
              <Select
                value=""
                onChange={pickAccount}
                placeholder={accounts.length ? 'Your characters…' : 'Pick…'}
                ariaLabel="Load levels from"
                className="w-44"
                options={[...accounts.map((a) => ({ value: a.rsn, label: a.rsn })), { value: '__other', label: 'Another RSN…' }]}
              />
              {otherRsn != null && (
                <>
                  <input
                    autoFocus
                    value={otherRsn}
                    onChange={(e) => setOtherRsn(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadFromHiscores(otherRsn)}
                    maxLength={12}
                    placeholder="RSN"
                    className="w-28 rounded border border-card-border bg-brown-dark px-2 py-1"
                  />
                  <button type="button" onClick={() => loadFromHiscores(otherRsn)} className="rounded border border-card-border px-2 py-1 hover:text-gold">
                    Load
                  </button>
                </>
              )}
            </div>
            {statsMsg && <p className="w-full text-[11px] text-text-muted">{statsMsg}</p>}
          </div>

          <div className="grid gap-5 p-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              {multi && (
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-text-muted">Numbers vs</span>
                  {monsters.map((m, i) => (
                    <button
                      key={monsterKeyOf(m)}
                      type="button"
                      onClick={() => setViewTarget(i)}
                      className={`rounded-md border px-2 py-0.5 ${shownTarget === m ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`}
                    >
                      {m.n.replace(/ the .*$/, '')}
                    </button>
                  ))}
                </div>
              )}
              <LoadoutEditor value={mine} onChange={updateMine} idx={idx} monster={shownTarget} />
            </div>

            <div className="space-y-5">
              {/* Upgrade route for the active setup */}
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Upgrade route <span className="font-normal text-text-muted">for {saved.setups[active].name}</span>
                </h4>
                {!route ? (
                  <p className="text-xs text-text-muted">Pricing upgrades…</p>
                ) : route.steps.length === 0 && route.untradeable.length === 0 ? (
                  <p className="text-xs text-text-muted">Nothing this guide recommends beats what you have for this style.</p>
                ) : (
                  <div className="space-y-3">
                    {route.steps.length > 0 && (
                      <ol className="space-y-1">
                        {route.steps.map((s, i) => (
                          <li key={s.item.id} className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1 text-xs">
                            <span className="w-4 text-right text-text-muted">{i + 1}</span>
                            <ItemIcon item={s.item} size={24} />
                            <span className="min-w-0 flex-1 truncate">{s.item.n}</span>
                            <span className="w-12 text-right text-emerald-300">+{s.gain.toFixed(2)}</span>
                            <span className="w-14 text-right text-text-muted">{s.price != null ? formatGp(s.price) : '—'}</span>
                          </li>
                        ))}
                        <li className="flex justify-end gap-3 px-2 pt-1 text-[11px] text-text-muted">
                          <span>
                            All of it: <span className="text-foreground">{formatGp(route.steps[route.steps.length - 1].totalCost)}</span>
                          </span>
                          <span>
                            {route.start.toFixed(2)} → <span className="font-semibold text-gold">{route.steps[route.steps.length - 1].dpsAfter.toFixed(2)} DPS</span>
                          </span>
                        </li>
                      </ol>
                    )}
                    {route.untradeable.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-widest text-text-muted">Not on the GE — earned or untradeable version</p>
                        <ul className="space-y-1">
                          {route.untradeable.map((u) => (
                            <li key={u.item.id} className="flex items-center gap-2 px-2 text-xs">
                              <ItemIcon item={u.item} size={22} />
                              <span className="min-w-0 flex-1 truncate">{u.item.n}</span>
                              <span className="text-emerald-300">+{u.gain.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[11px] text-text-muted">Cheapest DPS first, among the items this guide recommends for your combat style. GE prices.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-card-border p-3">
      {/* Compare */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Compare</h4>
          <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <input type="checkbox" checked={withGuide} onChange={(e) => setWithGuide(e.target.checked)} className="accent-[#e0b341]" />
            Guide setups
          </label>
        </div>
        <div className="overflow-x-auto rounded-lg border border-card-border">
          <table className="w-full text-xs">
            <thead className="bg-black/30 text-left text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-2 py-1.5 font-normal">Setup</th>
                <th className="w-1/2 px-2 py-1.5 font-normal">DPS</th>
                {!multi && <th className="px-2 py-1.5 text-right font-normal">Max</th>}
                {!multi && <th className="px-2 py-1.5 text-right font-normal">Acc</th>}
                <th className="px-2 py-1.5 text-right font-normal">{multi ? 'Full run' : 'Kill'}</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row, i) => {
                const pct = (row.dps / bestDps) * 100;
                return (
                  <tr
                    key={i}
                    onClick={() => row.mine != null && setSaved({ ...saved, active: row.mine })}
                    className={`border-t border-card-border/60 ${row.mine != null ? 'cursor-pointer hover:bg-white/5' : ''} ${row.mine === active ? 'bg-gold/10' : ''}`}
                  >
                    <td className="max-w-[14rem] px-2 py-1.5">
                      <div className={`truncate font-medium ${row.mine != null ? 'text-gold' : ''}`}>{row.label}</div>
                      <div className={`text-[10px] ${row.tone ? TIER_TONE[row.tone].text : 'text-text-muted'}`}>{row.sub}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div className={`h-full rounded-full ${row.tone ? TIER_TONE[row.tone].bar : 'bg-gold'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 text-right font-semibold">{row.dps ? row.dps.toFixed(2) : '—'}</span>
                      </div>
                      {pct < 99.95 && <div className="text-[10px] text-text-muted">−{(100 - pct).toFixed(0)}% vs best</div>}
                    </td>
                    {!multi && <td className="px-2 py-1.5 text-right">{row.maxHit ?? '—'}</td>}
                    {!multi && <td className="px-2 py-1.5 text-right">{row.acc != null ? `${(row.acc * 100).toFixed(0)}%` : '—'}</td>}
                    <td className="px-2 py-1.5 text-right">{fmtTime(row.time)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
          </div>
        </div>
      )}

      {copied && <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">{copied}</p>}
      <p className="text-[11px] text-text-muted">
        Numbers from Anvil’s calculator on the OSRS Wiki’s combat formulas. Ignores downtime, specs and boss mechanics; approximated effects say so.
      </p>
    </section>
  );
}

const shortName = (m: Monster) => m.n.replace(/ the .*$/, '');

/** One of the guide's setups: what to wear (and carry), what it does, and the ways to take it with you. */
function SetupCard({
  setup,
  r,
  perTarget,
  multi,
  everyTarget,
  idx,
  names,
  onExport,
  onUse,
}: {
  setup: GearSetup;
  r: DpsResult | null;
  perTarget: { m: Monster; r: DpsResult | null }[];
  multi: boolean;
  everyTarget: boolean;
  idx: GearIndex;
  names: ItemNames;
  onExport: (s: GearSetup, kind: 'banktag' | 'setup') => void;
  onUse: (s: GearSetup) => void;
}) {
  const tone = TIER_TONE[setup.tier];
  const hasInv = !!(setup.inventory?.some(Boolean) || setup.runePouch?.length);
  const [view, setView] = useState<'gear' | 'inv'>('gear');
  const btn = 'whitespace-nowrap rounded-md border border-card-border px-2 py-1 text-[11px] text-text-muted transition-colors hover:border-gold/50 hover:text-gold';
  return (
    <article className={`flex flex-col gap-3 rounded-xl border ${tone.border} bg-black/25 p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {!multi && (
            <div className={`text-[11px] font-semibold uppercase tracking-widest ${tone.text}`}>
              {tierOf(setup.tier)?.emoji} {tierOf(setup.tier)?.label}
            </div>
          )}
          <div className="truncate font-semibold">{setup.name}</div>
          <div className="text-[11px] text-text-muted">
            {setup.stats.attack}/{setup.stats.strength}/{setup.stats.ranged}/{setup.stats.magic} att/str/rng/mag
          </div>
        </div>
        {hasInv && (
          <div className="flex shrink-0 rounded-md border border-card-border p-0.5 text-[11px]" role="tablist">
            {(['gear', 'inv'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded px-2 py-0.5 transition-colors ${view === v ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}
              >
                {v === 'gear' ? 'Gear' : 'Inventory'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`flex gap-3 ${multi ? 'items-start' : 'flex-col items-center'}`}>
        <div className="flex min-h-[182px] shrink-0 items-center justify-center">
          {view === 'inv' && hasInv ? (
            <InventoryPanel inventory={setup.inventory} runePouch={setup.runePouch} names={names} readOnly size={22} />
          ) : (
            <EquipmentPanel gear={setup.gear} items={idx.items} lookup={idx.item} readOnly size={32} />
          )}
        </div>
        {multi ? (
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">{everyTarget ? 'Every target' : 'Used on'}</div>
            <ul className="space-y-1 text-xs">
              {perTarget.map(({ m, r: tr }) => (
                <li key={monsterKeyOf(m)} className="flex items-baseline justify-between gap-2 rounded bg-black/25 px-2 py-1">
                  <span className="truncate">{shortName(m)}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="font-semibold text-gold">{tr ? tr.dps.toFixed(2) : '—'}</span>
                    <span className="text-text-muted"> · {killTime(tr)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="grid w-full grid-cols-3 gap-2 text-center">
            {[
              ['DPS', r ? r.dps.toFixed(2) : '—', 'text-gold'],
              ['Max hit', String(r?.maxHit ?? '—'), ''],
              ['Kill', killTime(r), ''],
            ].map(([label, value, cls]) => (
              <div key={label}>
                <div className={`text-lg font-bold leading-none ${cls}`}>{value}</div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {setup.note && <p className="text-[11px] text-text-muted">{setup.note}</p>}
      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-card-border/50 pt-2.5">
        <button type="button" onClick={() => onUse(setup)} className={`${btn} text-foreground`}>
          Try it in my setups
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => onExport(setup, 'banktag')} className={btn} title="RuneLite Bank Tags — in the bank, right-click the + tab → Import tag tab">
          Bank tag
        </button>
        <button type="button" onClick={() => onExport(setup, 'setup')} className={btn} title="RuneLite Inventory Setups plugin — Import setup">
          Inventory Setup
        </button>
      </div>
    </article>
  );
}
