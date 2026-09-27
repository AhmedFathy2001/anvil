'use client';

import { useMemo, useState } from 'react';

import { bestStyle } from '@/lib/dps/engine';
import { monsterKey, monsterLabel, setupLoadout } from '@/lib/dps/summary';
import { TIERS, tierOf, type GearBlock, type GearSetup, type TierKey } from '@/lib/guideTiers';
import LoadoutEditor, { DEFAULT_STATS, ResultLine } from './LoadoutEditor';
import { useGearData } from './useGearData';
import Select from '@/components/Select';

/**
 * Build a guide's gear progression: pick the monster, then a setup (or several) for each level,
 * with live DPS as you go. Writes one ```gear block into the guide — authors never hand-edit JSON.
 */
export default function GearBuilder({
  initial,
  onSave,
  onClose,
}: {
  initial: GearBlock | null;
  onSave: (block: GearBlock) => void;
  onClose: () => void;
}) {
  const { idx, error } = useGearData();
  const [monsterId, setMonsterId] = useState(initial?.monster ?? '');
  const [setups, setSetups] = useState<GearSetup[]>(initial?.setups ?? []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(0);

  const monster = useMemo(() => (idx && monsterId ? idx.monster(monsterId) : null), [idx, monsterId]);
  const matches = useMemo(() => {
    if (!idx || !q.trim()) return [];
    const needle = q.trim().toLowerCase();
    return idx.monsters
      .filter((m) => !m.hid && m.n.toLowerCase().includes(needle))
      .sort((a, b) => Number(!a.n.toLowerCase().startsWith(needle)) - Number(!b.n.toLowerCase().startsWith(needle)) || (b.cb ?? 0) - (a.cb ?? 0))
      .slice(0, 30);
  }, [idx, q]);

  const add = (tier: TierKey) => {
    const prev = [...setups].reverse().find((s) => s.tier === tier) ?? setups[setups.length - 1];
    const next: GearSetup = prev
      ? { ...prev, tier, name: `${tierOf(tier)?.label} setup`, stats: DEFAULT_STATS[tier] }
      : { tier, name: `${tierOf(tier)?.label} setup`, gear: {}, style: 0, stats: DEFAULT_STATS[tier] };
    const list = [...setups, next].sort((a, b) => TIERS.findIndex((t) => t.key === a.tier) - TIERS.findIndex((t) => t.key === b.tier));
    setSetups(list);
    setOpen(list.indexOf(next));
  };
  const update = (i: number, patch: Partial<GearSetup>) => setSetups((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const missing = TIERS.filter((t) => !setups.some((s) => s.tier === t.key));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl rounded-xl border border-card-border bg-card-bg p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gold">⚔️ Gear progression</h2>
          <button onClick={onClose} className="text-sm text-text-muted hover:text-foreground">
            Close
          </button>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {!idx ? (
          <p className="text-sm text-text-muted">Loading items and monsters…</p>
        ) : (
          <div className="space-y-4">
            {/* Monster */}
            <div className="relative">
              <label className="block text-xs text-text-muted">
                Against
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={monster ? monsterLabel(monster) : 'Search a boss or monster…'}
                  className="mt-1 w-full rounded border border-card-border bg-brown-dark px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </label>
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-card-border bg-card-bg text-sm shadow-xl">
                  {matches.map((m) => (
                    <li key={monsterKey(m)}>
                      <button
                        onClick={() => {
                          setMonsterId(monsterKey(m));
                          setQ('');
                        }}
                        className="flex w-full justify-between px-3 py-1.5 text-left hover:bg-white/10"
                      >
                        <span>{monsterLabel(m)}</span>
                        <span className="text-xs text-text-muted">
                          lvl {m.cb} · {m.hp} HP
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {monster && (
                <p className="mt-1 text-xs text-text-muted">
                  {monsterLabel(monster)} — {monster.hp} HP, Defence {monster.lv[0]}, Magic {monster.lv[1]}
                  {monster.a?.length ? `, ${monster.a.join('/')}` : ''}
                  {monster.ew ? `, weak to ${monster.ew} ${monster.ewp}%` : ''}
                </p>
              )}
            </div>

            {/* Setups */}
            <div className="space-y-2">
              {setups.map((s, i) => {
                const r = monster ? (bestStyle(setupLoadout(s), monster, idx.item, idx.rules)?.result ?? null) : null;
                return (
                  <div key={i} className="rounded-lg border border-card-border bg-black/20">
                    <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left">
                      <span className="text-sm">
                        <span className="mr-2">{tierOf(s.tier)?.emoji}</span>
                        <span className="font-semibold">{s.name}</span>
                      </span>
                      <span className="text-xs text-text-muted">
                        <ResultLine r={r} />
                      </span>
                    </button>
                    {open === i && (
                      <div className="space-y-3 border-t border-card-border p-3">
                        <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                          <Select
                            value={s.tier}
                            onChange={(v) => update(i, { tier: v as TierKey })}
                            ariaLabel="Level"
                            options={TIERS.map((t) => ({ value: t.key, label: `${t.emoji} ${t.label}` }))}
                          />
                          <input
                            value={s.name}
                            onChange={(e) => update(i, { name: e.target.value.slice(0, 60) })}
                            placeholder="Setup name, e.g. Budget ranged"
                            className="rounded border border-card-border bg-brown-dark px-2 py-1 text-xs"
                          />
                          <button onClick={() => setSetups((list) => list.filter((_, j) => j !== i))} className="text-xs text-red-300 hover:underline">
                            Remove
                          </button>
                        </div>
                        <LoadoutEditor
                          value={setupLoadout(s)}
                          onChange={(l) =>
                            update(i, {
                              gear: l.gear as Record<string, number>,
                              style: l.style,
                              spell: l.spell ?? null,
                              dart: l.dart ?? null,
                              stats: l.stats,
                              prayer: l.prayer ?? null,
                              boost: l.boost ?? null,
                              onTask: l.onTask ?? false,
                            })
                          }
                          idx={idx}
                          monster={monster}
                        />
                        <input
                          value={s.note ?? ''}
                          onChange={(e) => update(i, { note: e.target.value.slice(0, 140) || undefined })}
                          placeholder="Note (optional) — e.g. swap to a dragon dagger for specs"
                          className="w-full rounded border border-card-border bg-brown-dark px-2 py-1 text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {TIERS.map((t) => (
                <button key={t.key} onClick={() => add(t.key)} className="rounded-lg border border-card-border px-3 py-1.5 text-xs hover:border-gold/50">
                  + {t.emoji} {t.label} setup
                </button>
              ))}
              {missing.length > 0 && <span className="text-xs text-amber-200">Still needs: {missing.map((t) => t.label).join(', ')}</span>}
            </div>

            <div className="flex justify-end gap-2 border-t border-card-border pt-3">
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={() => onSave({ monster: monsterId, setups })}
                disabled={!monster || setups.length === 0}
                className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-40"
              >
                {initial ? 'Update guide' : 'Insert into guide'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
