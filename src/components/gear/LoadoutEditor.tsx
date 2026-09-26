'use client';

import { useMemo } from 'react';

import { calculate, type DpsResult, type Loadout, type Monster } from '@/lib/dps/engine';
import { BOOSTS, PRAYERS, SPELLS, stylesFor, type Slot } from '@/lib/dps/tables';
import type { GearIndex } from '@/lib/dps/summary';
import ItemPicker from './ItemPicker';

// The equipment screen's layout: three columns, the slots where a player expects them.
const GRID: (Slot | null)[] = ['head', null, null, 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', null, 'legs', null, 'hands', 'feet', 'ring'];
const STAT_KEYS = ['attack', 'strength', 'ranged', 'magic'] as const;

const sel = 'w-full rounded border border-card-border bg-brown-dark px-2 py-1 text-xs focus:border-gold focus:outline-none';

/** Result line: DPS, max hit, accuracy, time to kill. */
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

/**
 * Edit one loadout — gear per slot, style, spell/darts where they apply, levels, prayer and boost —
 * with its DPS against the monster live underneath.
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
  const style = styles[Math.min(value.style, styles.length - 1)] ?? styles[0];
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
      <div className="grid grid-cols-3 gap-1.5">
        {GRID.map((slot, i) =>
          slot ? (
            <ItemPicker key={slot} slot={slot} items={idx.items} value={value.gear[slot]} onChange={(id) => setSlot(slot, id)} disabled={readOnly} />
          ) : (
            <span key={`g${i}`} />
          ),
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 block text-[11px] text-text-muted">
          Style
          <select className={sel} disabled={readOnly} value={Math.min(value.style, styles.length - 1)} onChange={(e) => onChange({ ...value, style: Number(e.target.value) })}>
            {styles.map((st, i) => (
              <option key={i} value={i}>
                {st.name} ({st.type}, {st.stance})
              </option>
            ))}
          </select>
        </label>
        {style.stance === 'autocast' && (
          <label className="col-span-2 block text-[11px] text-text-muted">
            Spell
            <select className={sel} disabled={readOnly} value={value.spell ?? ''} onChange={(e) => onChange({ ...value, spell: e.target.value || null })}>
              <option value="">Pick a spell…</option>
              {SPELLS.map((sp) => (
                <option key={sp.name} value={sp.name}>
                  {sp.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isBlowpipe && (
          <label className="col-span-2 block text-[11px] text-text-muted">
            Darts
            <select className={sel} disabled={readOnly} value={value.dart ?? ''} onChange={(e) => onChange({ ...value, dart: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Pick darts…</option>
              {darts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STAT_KEYS.map((k) => (
          <label key={k} className="block text-[11px] capitalize text-text-muted">
            {k}
            <input
              type="number"
              min={1}
              max={99}
              disabled={readOnly}
              value={value.stats[k]}
              onChange={(e) => onChange({ ...value, stats: { ...value.stats, [k]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) } })}
              className={sel}
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-text-muted">
          Prayer
          <select className={sel} disabled={readOnly} value={value.prayer ?? ''} onChange={(e) => onChange({ ...value, prayer: e.target.value || null })}>
            <option value="">None</option>
            {PRAYERS.filter((p) => p.style === kind).map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] text-text-muted">
          Boost
          <select className={sel} disabled={readOnly} value={value.boost ?? ''} onChange={(e) => onChange({ ...value, boost: e.target.value || null })}>
            <option value="">None</option>
            {BOOSTS.filter((b) => b.style === kind).map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-text-muted">
        <input type="checkbox" disabled={readOnly} checked={value.onTask === true} onChange={(e) => onChange({ ...value, onTask: e.target.checked })} className="accent-[#e0b341]" />
        On a slayer task (slayer helm / black mask)
      </label>

      <div className="rounded bg-black/20 px-2 py-1.5 text-xs">
        {monster ? <ResultLine r={result} /> : <span className="text-text-muted">Pick a monster to see DPS.</span>}
        {result?.notes.map((n) => (
          <p key={n} className="mt-1 text-[11px] text-amber-200/80">
            {n}
          </p>
        ))}
      </div>
    </div>
  );
}

export const DEFAULT_STATS: Record<string, Loadout['stats']> = {
  beginner: { attack: 70, strength: 70, ranged: 75, magic: 75 },
  intermediate: { attack: 85, strength: 85, ranged: 90, magic: 90 },
  advanced: { attack: 99, strength: 99, ranged: 99, magic: 99 },
};
