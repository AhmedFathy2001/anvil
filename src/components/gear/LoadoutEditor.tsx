'use client';

import { useMemo } from 'react';

import { calculate, type DpsResult, type Loadout, type Monster } from '@/lib/dps/engine';
import { BOOSTS, PRAYERS, SPELLS, prayerKeys, stylesFor, togglePrayer, type Slot } from '@/lib/dps/tables';
import type { GearIndex } from '@/lib/dps/summary';
import EquipmentPanel from './EquipmentPanel';
import Select from '@/components/Select';

const wiki = (file: string) => `https://oldschool.runescape.wiki/images/${encodeURIComponent(file.replace(/ /g, '_'))}`;

const STATS = [
  { key: 'attack', label: 'Attack', icon: 'Attack icon.png' },
  { key: 'strength', label: 'Strength', icon: 'Strength icon.png' },
  { key: 'ranged', label: 'Ranged', icon: 'Ranged icon.png' },
  { key: 'magic', label: 'Magic', icon: 'Magic icon.png' },
] as const;


const sel = 'w-full rounded border border-card-border bg-brown-dark px-2 py-1 text-xs focus:border-gold focus:outline-none';
const chip = (on: boolean) =>
  `rounded-md border px-2 py-1 text-[11px] transition-colors ${on ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`;

/** Compact one-line result, for lists. */
export function ResultLine({ r }: { r: DpsResult | null }) {
  if (!r) return <span className="text-text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      <span>
        <span className="font-semibold text-gold">{r.dps.toFixed(2)}</span> DPS
      </span>
      <span>max {r.maxHit}</span>
      <span>{(r.accuracy * 100).toFixed(1)}% acc</span>
      <span>{Number.isFinite(r.ttk) ? `${Math.round(r.ttk)}s/kill` : '—'}</span>
    </span>
  );
}

/** The headline numbers for a loadout: DPS large, then what makes it up. */
export function StatBar({ r }: { r: DpsResult | null }) {
  const cell = (label: string, value: string) => (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="truncate text-sm font-semibold">{value}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-5 items-end gap-3 rounded-lg border border-card-border bg-black/30 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">DPS</div>
        <div className="text-2xl font-bold leading-none text-gold">{r ? r.dps.toFixed(2) : '—'}</div>
      </div>
      {cell('Max hit', r ? String(r.maxHit) : '—')}
      {cell('Accuracy', r ? `${(r.accuracy * 100).toFixed(1)}%` : '—')}
      {cell('Speed', r ? `${(r.speed * 0.6).toFixed(1)}s` : '—')}
      {cell('Kill time', r && Number.isFinite(r.ttk) ? `${Math.floor(r.ttk / 60)}:${String(Math.round(r.ttk % 60)).padStart(2, '0')}` : '—')}
    </div>
  );
}

/**
 * Edit one loadout: equipment on the in-game grid, then style, levels, prayer and boost — with its
 * numbers against the monster live underneath.
 */
export default function LoadoutEditor({
  value,
  onChange,
  idx,
  monster,
  readOnly,
}: {
  value: Loadout;
  onChange: (next: Loadout) => void;
  idx: GearIndex;
  monster: Monster | null;
  readOnly?: boolean;
}) {
  const weapon = idx.item(value.gear.weapon);
  const styles = stylesFor(weapon?.c);
  const styleIndex = Math.min(value.style, styles.length - 1);
  const style = styles[styleIndex] ?? styles[0];
  const kind = style.type === 'magic' ? 'magic' : style.type === 'ranged' ? 'ranged' : 'melee';
  const isBlowpipe = /blowpipe/i.test(weapon?.n ?? '');
  const darts = useMemo(() => idx.items.filter((i) => !i.hid && i.c === 'Thrown' && / dart$/i.test(i.n)), [idx.items]);
  const result = useMemo(() => (monster ? calculate(value, monster, idx.item, idx.rules) : null), [value, monster, idx]);

  const setSlot = (slot: Slot, id: number | null) => {
    const gear = { ...value.gear };
    if (id == null) delete gear[slot];
    else gear[slot] = id;
    // A two-handed weapon empties the shield slot, and a shield takes the place of one.
    const w = idx.item(gear.weapon);
    if (slot === 'weapon' && w?.h2) delete gear.shield;
    if (slot === 'shield' && id != null && w?.h2) delete gear.weapon;
    onChange({ ...value, gear, style: slot === 'weapon' ? 0 : value.style });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <EquipmentPanel gear={value.gear} items={idx.items} lookup={idx.item} onChange={setSlot} readOnly={readOnly} />

        <div className="min-w-[220px] flex-1 space-y-3">
          <div>
            <div className="mb-1 text-[11px] text-text-muted">Attack style</div>
            <div className="flex flex-wrap gap-1">
              {styles.map((st, i) => (
                <button key={i} type="button" disabled={readOnly} onClick={() => onChange({ ...value, style: i })} className={chip(i === styleIndex)} title={`${st.type}, ${st.stance}`}>
                  {st.name}
                  <span className="ml-1 opacity-60">{st.type === 'magic' || st.type === 'ranged' ? st.stance : st.type}</span>
                </button>
              ))}
            </div>
          </div>
          {style.stance === 'autocast' && (
            <label className="block text-[11px] text-text-muted">
              Spell
              <Select
                value={value.spell ?? ''}
                disabled={readOnly}
                onChange={(v) => onChange({ ...value, spell: v || null })}
                placeholder="Pick a spell…"
                searchable
                ariaLabel="Spell"
                options={SPELLS.map((sp) => ({ value: sp.name, label: sp.name }))}
              />
            </label>
          )}
          {isBlowpipe && (
            <label className="block text-[11px] text-text-muted">
              Darts
              <Select
                value={value.dart != null ? String(value.dart) : ''}
                disabled={readOnly}
                onChange={(v) => onChange({ ...value, dart: v ? Number(v) : null })}
                placeholder="Pick darts…"
                ariaLabel="Darts"
                options={darts.map((d) => ({ value: String(d.id), label: d.n }))}
              />
            </label>
          )}

          <div>
            <div className="mb-1 text-[11px] text-text-muted">Levels</div>
            <div className="grid grid-cols-2 gap-1.5">
              {STATS.map((s) => (
                <label key={s.key} className="flex items-center gap-1 rounded border border-card-border bg-brown-dark px-1.5 py-1" title={s.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wiki(s.icon)} alt={s.label} className="h-4 w-4 shrink-0 object-contain" />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    disabled={readOnly}
                    value={value.stats[s.key]}
                    onChange={(e) => onChange({ ...value, stats: { ...value.stats, [s.key]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) } })}
                    className="w-full min-w-0 bg-transparent text-xs focus:outline-none"
                    aria-label={s.label}
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] text-text-muted">Prayers <span className="opacity-60">— combine like in game</span></div>
            <div className="flex flex-wrap gap-1">
              {PRAYERS.filter((p) => p.style === kind).map((p) => {
                const on = prayerKeys(value.prayer).includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ ...value, prayer: togglePrayer(prayerKeys(value.prayer), p.key) })}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${on ? 'border-gold bg-gold/20' : 'border-card-border opacity-60 hover:opacity-100'}`}
                    title={`${p.label}${p.acc !== 1 ? ` · accuracy +${Math.round((p.acc - 1) * 100)}%` : ''}${p.str !== 1 ? ` · strength +${Math.round((p.str - 1) * 100)}%` : ''}`}
                    aria-pressed={on}
                    aria-label={p.label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={wiki(p.icon)} alt="" className="h-5 w-5 object-contain" />
                  </button>
                );
              })}
            </div>
          </div>

          {/dharok's/i.test(idx.item(value.gear.body)?.n ?? '') && /dharok's greataxe/i.test(weapon?.n ?? '') && (
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block text-[11px] text-text-muted">
                Hitpoints level
                <input type="number" min={10} max={99} disabled={readOnly} value={value.stats.hitpoints ?? 99} onChange={(e) => onChange({ ...value, stats: { ...value.stats, hitpoints: Math.max(10, Math.min(99, Number(e.target.value) || 99)) } })} className={sel} />
              </label>
              <label className="block text-[11px] text-text-muted">
                Current HP (Dharok&apos;s)
                <input type="number" min={1} max={99} disabled={readOnly} value={value.stats.currentHp ?? value.stats.hitpoints ?? 99} onChange={(e) => onChange({ ...value, stats: { ...value.stats, currentHp: Math.max(1, Math.min(value.stats.hitpoints ?? 99, Number(e.target.value) || 1)) } })} className={sel} />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex-1 text-[11px] text-text-muted">
              Boost
              <Select
                value={value.boost ?? ''}
                disabled={readOnly}
                onChange={(v) => onChange({ ...value, boost: v || null })}
                ariaLabel="Boost"
                options={[{ value: '', label: 'None' }, ...BOOSTS.filter((b) => b.style === kind).map((b) => ({ value: b.key, label: b.label }))]}
              />
            </label>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-text-muted">
              <input type="checkbox" disabled={readOnly} checked={value.onTask === true} onChange={(e) => onChange({ ...value, onTask: e.target.checked })} className="accent-[#e0b341]" />
              On slayer task
            </label>
          </div>
        </div>
      </div>

      {monster ? <StatBar r={result} /> : <p className="text-xs text-text-muted">Pick a monster to see DPS.</p>}
      {result?.notes.map((n) => (
        <p key={n} className="text-[11px] text-amber-200/80">
          {n}
        </p>
      ))}
    </div>
  );
}

export const DEFAULT_STATS: Record<string, Loadout['stats']> = {
  beginner: { attack: 70, strength: 70, ranged: 75, magic: 75 },
  intermediate: { attack: 85, strength: 85, ranged: 90, magic: 90 },
  advanced: { attack: 99, strength: 99, ranged: 99, magic: 99 },
};
