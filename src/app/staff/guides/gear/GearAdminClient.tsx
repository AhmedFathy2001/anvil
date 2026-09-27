'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import Select from '@/components/Select';
import { ItemIcon } from '@/components/gear/ItemIcon';
import { reloadGearIndex } from '@/components/gear/useGearData';
import type { GearItem, Monster } from '@/lib/dps/engine';
import type { EffectRule } from '@/lib/dps/effects';
import { SLOTS, WEAPON_STYLES } from '@/lib/dps/tables';
import type { GearIndex } from '@/lib/dps/summary';

interface Override {
  id: number;
  kind: 'item' | 'monster' | 'effect';
  key: string;
  data: Record<string, unknown>;
  hidden: boolean;
  note: string | null;
  updatedAt: string;
}
interface Meta {
  canEdit: boolean;
  source: { kind: 'bundled' | 'refresh'; refreshedAt: string | null; itemCount: number; monsterCount: number; overrides: number };
  overrides: Override[];
  datasets: { id: number; createdAt: string; itemCount: number; monsterCount: number }[];
}

type Tab = 'data' | 'items' | 'monsters' | 'effects';
const input = 'w-full rounded border border-card-border bg-brown-dark px-2 py-1 text-xs focus:border-gold focus:outline-none';
const BONUS_LABELS = ['Stab', 'Slash', 'Crush', 'Magic', 'Ranged', 'Strength', 'Ranged str', 'Magic dmg %', 'Prayer'];
const DEF_LABELS = ['Stab', 'Slash', 'Crush', 'Magic', 'Light rng', 'Standard rng', 'Heavy rng'];
const monsterKey = (m: Pick<Monster, 'n' | 'v'>) => (m.v ? `${m.n}#${m.v}` : m.n);

/**
 * The gear calculator's data, managed by the platform: refresh from the wiki, fix or add items and
 * monsters, hide junk, and add effect rules for gear the engine doesn't know. Every change applies
 * to every clan at once; every change can be reverted.
 */
export default function GearAdminClient({ canEdit }: { canEdit: boolean }) {
  const { confirm, notify } = useDialog();
  const [tab, setTab] = useState<Tab>('data');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [idx, setIdx] = useState<GearIndex | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([fetch('/api/staff/gear', { cache: 'no-store' }).then((r) => r.json()), reloadGearIndex()]);
    setMeta(m);
    setIdx(i);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const overrideOf = useCallback(
    (kind: Override['kind'], key: string) => meta?.overrides.find((o) => o.kind === kind && o.key === key) ?? null,
    [meta],
  );

  async function put(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/staff/gear/overrides', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(j.error ?? 'Save failed', 'error');
        return false;
      }
      notify(done);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }
  async function revert(kind: Override['kind'], key: string) {
    if (!(await confirm({ title: 'Revert to the wiki data?', body: kind === 'effect' ? 'Deletes this rule.' : 'Drops every staff change to this entry.', confirmLabel: 'Revert', tone: 'danger' }))) return;
    await fetch(`/api/staff/gear/overrides?kind=${kind}&key=${encodeURIComponent(key)}`, { method: 'DELETE' });
    notify('Reverted');
    await load();
  }
  async function refresh() {
    if (!(await confirm({ title: 'Refresh from the OSRS Wiki?', body: 'Pulls every item and monster again (about half a minute). Your overrides stay on top. The previous data is kept for rollback.', confirmLabel: 'Refresh' }))) return;
    setBusy(true);
    try {
      const res = await fetch('/api/staff/gear/refresh', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) notify(j.error ?? 'Refresh failed', 'error');
      else notify(`Refreshed: ${j.items} items, ${j.monsters} monsters`);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function rollback(id: number) {
    if (!(await confirm({ title: 'Roll back this refresh?', body: 'The one before it (or the data shipped with Anvil) takes over.', confirmLabel: 'Roll back', tone: 'danger' }))) return;
    await fetch(`/api/staff/gear/datasets/${id}`, { method: 'DELETE' });
    await load();
  }

  if (!meta || !idx) return <p className="text-sm text-text-muted">Loading…</p>;
  const readOnly = !canEdit || busy;

  return (
    <div className="space-y-5">
      <div>
        <ClanLink href="/staff/guides" className="text-xs text-text-muted hover:text-gold">
          ← Guide library
        </ClanLink>
        <h1 className="mt-1 text-2xl font-bold text-gold">Gear calculator data</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-muted">
          What every guide&apos;s DPS numbers are computed from. Changes here apply to every clan at once — the calculator gives everyone the same
          answer. New boss or weapon out? Refresh from the wiki; if the wiki isn&apos;t there yet, add it by hand.
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {(['data', 'items', 'monsters', 'effects'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm capitalize ${tab === t ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}>
            {t === 'data' ? 'Dataset' : t === 'effects' ? `Effect rules (${idx.rules.length})` : t}
          </button>
        ))}
      </div>

      {tab === 'data' && (
        <section className="space-y-4 rounded-xl border border-card-border bg-card-bg p-4 text-sm">
          <p>
            Using{' '}
            <span className="text-gold">{meta.source.kind === 'refresh' ? `a wiki refresh from ${meta.source.refreshedAt?.slice(0, 16).replace('T', ' ')} UTC` : 'the data shipped with this Anvil version'}</span>
            : {meta.source.itemCount} items, {meta.source.monsterCount} monsters, {meta.source.overrides} staff change{meta.source.overrides === 1 ? '' : 's'} on top.
          </p>
          {canEdit && (
            <button onClick={refresh} disabled={busy} className="rounded-lg bg-gold px-4 py-2 font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-40">
              {busy ? 'Refreshing… (about half a minute)' : 'Refresh from the OSRS Wiki'}
            </button>
          )}
          {meta.datasets.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs uppercase tracking-widest text-text-muted">Refresh history</h3>
              <ul className="space-y-1 text-xs">
                {meta.datasets.map((d, i) => (
                  <li key={d.id} className="flex items-center gap-3">
                    <span className={i === 0 ? 'text-gold' : 'text-text-muted'}>{d.createdAt.slice(0, 16).replace('T', ' ')} UTC</span>
                    <span className="text-text-muted">
                      {d.itemCount} items · {d.monsterCount} monsters
                    </span>
                    {i === 0 && <span className="rounded-full bg-emerald-900/40 px-2 text-emerald-300">in use</span>}
                    {canEdit && i === 0 && (
                      <button onClick={() => rollback(d.id)} className="text-red-300 hover:underline">
                        Roll back
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-text-muted">Bundled data is regenerated at release time with <code>npm run data:gear</code>.</p>
        </section>
      )}

      {tab === 'items' && <ItemsTab idx={idx} overrideOf={overrideOf} readOnly={readOnly} put={put} revert={revert} />}
      {tab === 'monsters' && <MonstersTab idx={idx} overrideOf={overrideOf} readOnly={readOnly} put={put} revert={revert} />}
      {tab === 'effects' && <EffectsTab rules={idx.rules} readOnly={readOnly} put={put} revert={revert} />}
    </div>
  );
}

type Put = (body: Record<string, unknown>, done: string) => Promise<boolean>;
type Revert = (kind: Override['kind'], key: string) => Promise<void>;

function Badges({ o, hidden }: { o: Override | null; hidden?: boolean }) {
  return (
    <>
      {o && <span className="rounded-full bg-sky-900/40 px-1.5 text-[10px] text-sky-200">edited</span>}
      {hidden && <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-text-muted">hidden</span>}
    </>
  );
}

// ── Items ────────────────────────────────────────────────────────────────────────────────────

function ItemsTab({ idx, overrideOf, readOnly, put, revert }: { idx: GearIndex; overrideOf: (k: Override['kind'], key: string) => Override | null; readOnly: boolean; put: Put; revert: Revert }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<GearItem | 'new' | null>(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const src = n ? idx.items.filter((i) => i.n.toLowerCase().includes(n) || String(i.id) === n) : idx.items.filter((i) => i.ovr);
    return src.slice(0, 60);
  }, [q, idx.items]);

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items or an id…" className={input} />
          {!readOnly && (
            <button onClick={() => setEditing('new')} className="shrink-0 rounded border border-gold/50 px-2 text-xs text-gold hover:bg-gold/10">
              + Add item
            </button>
          )}
        </div>
        {!q && <p className="text-[11px] text-text-muted">Showing items staff have changed. Search to find any item.</p>}
        <ul className="max-h-[560px] divide-y divide-card-border overflow-y-auto rounded-lg border border-card-border bg-card-bg text-xs">
          {list.map((i) => (
            <li key={i.id}>
              <button onClick={() => setEditing(i)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5">
                <ItemIcon item={i} size={22} />
                <span className={`flex-1 truncate ${i.hid ? 'text-text-muted line-through' : ''}`}>{i.n}</span>
                <Badges o={overrideOf('item', String(i.id))} hidden={!!i.hid} />
                <span className="text-text-muted">{i.s}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-2 py-3 text-text-muted">Nothing here.</li>}
        </ul>
      </div>
      {editing && (
        <ItemForm
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          override={editing === 'new' ? null : overrideOf('item', String(editing.id))}
          readOnly={readOnly}
          put={put}
          revert={revert}
          onDone={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function ItemForm({ item, override, readOnly, put, revert, onDone }: { item: GearItem | null; override: Override | null; readOnly: boolean; put: Put; revert: Revert; onDone: () => void }) {
  const [f, setF] = useState(() => ({
    id: item?.id ?? '',
    n: item?.n ?? '',
    s: item?.s ?? 'weapon',
    h2: !!item?.h2,
    b: item?.b ?? [0, 0, 0, 0, 0, 0, 0, 0, 0],
    df: item?.df ?? 0,
    sp: item?.sp ?? '',
    c: item?.c ?? '',
    img: item?.img ?? '',
    note: override?.note ?? '',
  }));
  const save = async () => {
    const ok = await put(
      { kind: 'item', key: String(f.id), note: f.note, data: { n: f.n, s: f.s, h2: f.h2, b: f.b, df: f.df, sp: f.sp === '' ? undefined : f.sp, c: f.c || undefined, img: f.img } },
      item ? 'Item updated' : 'Item added',
    );
    if (ok && !item) onDone();
  };
  return (
    <div className="space-y-3 rounded-xl border border-card-border bg-card-bg p-4 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{item ? item.n : 'New item'}</h3>
        <button onClick={onDone} className="text-text-muted hover:text-foreground">Close</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">Item id<input className={input} disabled={!!item || readOnly} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} placeholder="game id" /></label>
        <label className="col-span-3 block">Name<input className={input} disabled={readOnly} value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} /></label>
        <label className="block">Slot<Select value={f.s} disabled={readOnly} onChange={(v) => setF({ ...f, s: v })} ariaLabel="Slot" options={SLOTS.map((s) => ({ value: s, label: s }))} /></label>
        <label className="block">Speed (ticks)<input className={input} disabled={readOnly} value={f.sp} onChange={(e) => setF({ ...f, sp: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
        <label className="col-span-2 block">Weapon category<Select value={f.c} disabled={readOnly} onChange={(v) => setF({ ...f, c: v })} ariaLabel="Weapon category" searchable options={[{ value: '', label: '—' }, ...Object.keys(WEAPON_STYLES).map((c) => ({ value: c, label: c }))]} /></label>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" disabled={readOnly} checked={f.h2} onChange={(e) => setF({ ...f, h2: e.target.checked })} /> Two-handed</label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {BONUS_LABELS.map((l, i) => (
          <label key={l} className="block">{l}<input className={input} type="number" disabled={readOnly} value={f.b[i]} onChange={(e) => setF({ ...f, b: f.b.map((v, j) => (j === i ? Number(e.target.value) : v)) })} /></label>
        ))}
        <label className="block">Defence total<input className={input} type="number" disabled={readOnly} value={f.df} onChange={(e) => setF({ ...f, df: Number(e.target.value) })} /></label>
      </div>
      <label className="block">Wiki icon file<input className={input} disabled={readOnly} value={f.img} onChange={(e) => setF({ ...f, img: e.target.value })} placeholder="Abyssal whip.png" /></label>
      <label className="block">Why (for the history)<input className={input} disabled={readOnly} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. wiki not updated for the new release yet" /></label>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button onClick={save} className="rounded bg-gold px-3 py-1 font-semibold text-brown-dark hover:bg-gold-light">Save</button>
          {item && <button onClick={() => put({ kind: 'item', key: String(item.id), hidden: !item.hid }, item.hid ? 'Shown again' : 'Hidden from pickers')} className="rounded border border-card-border px-3 py-1 hover:text-gold">{item.hid ? 'Unhide' : 'Hide from pickers'}</button>}
          {override && <button onClick={() => revert('item', String(item!.id)).then(onDone)} className="rounded border border-red-900 px-3 py-1 text-red-300 hover:bg-red-950/40">Revert to wiki</button>}
        </div>
      )}
      <p className="text-[11px] text-text-muted">Hidden items stay available to guides already using them; they just stop appearing in pickers.</p>
    </div>
  );
}

// ── Monsters ─────────────────────────────────────────────────────────────────────────────────

function MonstersTab({ idx, overrideOf, readOnly, put, revert }: { idx: GearIndex; overrideOf: (k: Override['kind'], key: string) => Override | null; readOnly: boolean; put: Put; revert: Revert }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Monster | 'new' | null>(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n ? idx.monsters.filter((m) => m.n.toLowerCase().includes(n)) : idx.monsters.filter((m) => m.ovr)).slice(0, 60);
  }, [q, idx.monsters]);
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search monsters…" className={input} />
          {!readOnly && <button onClick={() => setEditing('new')} className="shrink-0 rounded border border-gold/50 px-2 text-xs text-gold hover:bg-gold/10">+ Add monster</button>}
        </div>
        {!q && <p className="text-[11px] text-text-muted">Showing monsters staff have changed. Search to find any monster.</p>}
        <ul className="max-h-[560px] divide-y divide-card-border overflow-y-auto rounded-lg border border-card-border bg-card-bg text-xs">
          {list.map((m) => (
            <li key={monsterKey(m)}>
              <button onClick={() => setEditing(m)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5">
                <span className={`flex-1 truncate ${m.hid ? 'text-text-muted line-through' : ''}`}>{m.n}{m.v ? ` (${m.v})` : ''}</span>
                <Badges o={overrideOf('monster', monsterKey(m))} hidden={!!m.hid} />
                <span className="text-text-muted">{m.hp} HP</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-2 py-3 text-text-muted">Nothing here.</li>}
        </ul>
      </div>
      {editing && (
        <MonsterForm key={editing === 'new' ? 'new' : monsterKey(editing)} m={editing === 'new' ? null : editing} override={editing === 'new' ? null : overrideOf('monster', monsterKey(editing))} readOnly={readOnly} put={put} revert={revert} onDone={() => setEditing(null)} />
      )}
    </section>
  );
}

function MonsterForm({ m, override, readOnly, put, revert, onDone }: { m: Monster | null; override: Override | null; readOnly: boolean; put: Put; revert: Revert; onDone: () => void }) {
  const [f, setF] = useState(() => ({
    n: m?.n ?? '',
    v: m?.v ?? '',
    hp: m?.hp ?? 100,
    cb: m?.cb ?? 0,
    lv: m?.lv ?? [1, 1],
    mab: m?.mab ?? 0,
    d: m?.d ?? [0, 0, 0, 0, 0, 0, 0],
    a: (m?.a ?? []).join(', '),
    sz: m?.sz ?? 1,
    fa: m?.fa ?? 0,
    ew: m?.ew ?? '',
    ewp: m?.ewp ?? 0,
    note: override?.note ?? '',
  }));
  const key = m ? monsterKey(m) : '';
  const save = async () => {
    const ok = await put({ kind: 'monster', key, note: f.note, data: { ...f, note: undefined } }, m ? 'Monster updated' : 'Monster added');
    if (ok && !m) onDone();
  };
  const num = (v: string) => Number(v);
  return (
    <div className="space-y-3 rounded-xl border border-card-border bg-card-bg p-4 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{m ? `${m.n}${m.v ? ` (${m.v})` : ''}` : 'New monster'}</h3>
        <button onClick={onDone} className="text-text-muted hover:text-foreground">Close</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 block">Name<input className={input} disabled={!!m || readOnly} value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} /></label>
        <label className="col-span-2 block">Version<input className={input} disabled={!!m || readOnly} value={f.v} onChange={(e) => setF({ ...f, v: e.target.value })} placeholder="e.g. Hard mode" /></label>
        <label className="block">Hitpoints<input className={input} type="number" disabled={readOnly} value={f.hp} onChange={(e) => setF({ ...f, hp: num(e.target.value) })} /></label>
        <label className="block">Defence lvl<input className={input} type="number" disabled={readOnly} value={f.lv[0]} onChange={(e) => setF({ ...f, lv: [num(e.target.value), f.lv[1]] })} /></label>
        <label className="block">Magic lvl<input className={input} type="number" disabled={readOnly} value={f.lv[1]} onChange={(e) => setF({ ...f, lv: [f.lv[0], num(e.target.value)] })} /></label>
        <label className="block">Magic atk bonus<input className={input} type="number" disabled={readOnly} value={f.mab} onChange={(e) => setF({ ...f, mab: num(e.target.value) })} /></label>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {DEF_LABELS.map((l, i) => (
          <label key={l} className="block">{l}<input className={input} type="number" disabled={readOnly} value={f.d[i]} onChange={(e) => setF({ ...f, d: f.d.map((v, j) => (j === i ? num(e.target.value) : v)) })} /></label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 block">Attributes<input className={input} disabled={readOnly} value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} placeholder="dragon, undead" /></label>
        <label className="block">Size<input className={input} type="number" disabled={readOnly} value={f.sz} onChange={(e) => setF({ ...f, sz: num(e.target.value) })} /></label>
        <label className="block">Flat armour<input className={input} type="number" disabled={readOnly} value={f.fa} onChange={(e) => setF({ ...f, fa: num(e.target.value) })} /></label>
        <label className="block">Weak to<Select value={f.ew} disabled={readOnly} onChange={(v) => setF({ ...f, ew: v })} ariaLabel="Weak to" options={[{ value: '', label: '—' }, ...['air', 'water', 'earth', 'fire'].map((x) => ({ value: x, label: x }))]} /></label>
        <label className="block">Weakness %<input className={input} type="number" disabled={readOnly} value={f.ewp} onChange={(e) => setF({ ...f, ewp: num(e.target.value) })} /></label>
      </div>
      <label className="block">Why (for the history)<input className={input} disabled={readOnly} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button onClick={save} className="rounded bg-gold px-3 py-1 font-semibold text-brown-dark hover:bg-gold-light">Save</button>
          {m && <button onClick={() => put({ kind: 'monster', key, hidden: !m.hid }, m.hid ? 'Shown again' : 'Hidden from pickers')} className="rounded border border-card-border px-3 py-1 hover:text-gold">{m.hid ? 'Unhide' : 'Hide from pickers'}</button>}
          {override && <button onClick={() => revert('monster', key).then(onDone)} className="rounded border border-red-900 px-3 py-1 text-red-300 hover:bg-red-950/40">Revert to wiki</button>}
        </div>
      )}
    </div>
  );
}

// ── Effect rules ─────────────────────────────────────────────────────────────────────────────

const csv = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

function EffectsTab({ rules, readOnly, put, revert }: { rules: EffectRule[]; readOnly: boolean; put: Put; revert: Revert }) {
  const [editing, setEditing] = useState<EffectRule | 'new' | null>(null);
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-2">
        <p className="text-xs text-text-muted">
          Bonuses for gear the engine doesn&apos;t know yet — applied after its built-in effects (salve, slayer helm, void, dragon hunter, twisted bow…).
          Anything beyond an accuracy/damage multiplier needs code.
        </p>
        {!readOnly && <button onClick={() => setEditing('new')} className="rounded border border-gold/50 px-3 py-1 text-xs text-gold hover:bg-gold/10">+ Add rule</button>}
        <ul className="divide-y divide-card-border rounded-lg border border-card-border bg-card-bg text-xs">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
              <button onClick={() => setEditing(r)} className={`flex-1 text-left hover:text-gold ${r.enabled ? '' : 'text-text-muted line-through'}`}>{r.name}</button>
              <span className="text-text-muted">acc ×{r.accuracy} · dmg ×{r.damage}</span>
              {!readOnly && <button onClick={() => put({ kind: 'effect', key: r.id, data: { ...r, enabled: !r.enabled } }, r.enabled ? 'Rule off' : 'Rule on')} className="text-text-muted hover:text-gold">{r.enabled ? 'Turn off' : 'Turn on'}</button>}
            </li>
          ))}
          {rules.length === 0 && <li className="px-3 py-3 text-text-muted">No custom rules.</li>}
        </ul>
      </div>
      {editing && <RuleForm key={editing === 'new' ? 'new' : editing.id} rule={editing === 'new' ? null : editing} readOnly={readOnly} put={put} revert={revert} onDone={() => setEditing(null)} />}
    </section>
  );
}

function RuleForm({ rule, readOnly, put, revert, onDone }: { rule: EffectRule | null; readOnly: boolean; put: Put; revert: Revert; onDone: () => void }) {
  const [f, setF] = useState(() => ({
    name: rule?.name ?? '',
    enabled: rule?.enabled ?? true,
    weapons: (rule?.weapons ?? []).join(', '),
    wornAll: (rule?.wornAll ?? []).join(', '),
    wornAny: (rule?.wornAny ?? []).join(', '),
    kinds: rule?.kinds ?? [],
    monsterAttributes: (rule?.monsterAttributes ?? []).join(', '),
    monsters: (rule?.monsters ?? []).join(', '),
    onTask: rule?.onTask == null ? '' : rule.onTask ? 'yes' : 'no',
    accuracy: rule?.accuracy ?? 1,
    damage: rule?.damage ?? 1,
    note: rule?.note ?? '',
  }));
  const save = async () => {
    const ok = await put(
      {
        kind: 'effect',
        key: rule?.id,
        data: {
          name: f.name,
          enabled: f.enabled,
          weapons: csv(f.weapons),
          wornAll: csv(f.wornAll),
          wornAny: csv(f.wornAny),
          kinds: f.kinds,
          monsterAttributes: csv(f.monsterAttributes),
          monsters: csv(f.monsters),
          onTask: f.onTask === '' ? undefined : f.onTask === 'yes',
          accuracy: f.accuracy,
          damage: f.damage,
          note: f.note,
        },
      },
      rule ? 'Rule saved' : 'Rule added',
    );
    if (ok && !rule) onDone();
  };
  return (
    <div className="space-y-3 rounded-xl border border-card-border bg-card-bg p-4 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{rule ? rule.name : 'New effect rule'}</h3>
        <button onClick={onDone} className="text-text-muted hover:text-foreground">Close</button>
      </div>
      <label className="block">Name<input className={input} disabled={readOnly} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Emberlight vs demons" /></label>
      <p className="font-semibold text-text-muted">When (all that are filled in must hold)</p>
      <label className="block">Weapon is one of<input className={input} disabled={readOnly} value={f.weapons} onChange={(e) => setF({ ...f, weapons: e.target.value })} placeholder="item names, comma separated" /></label>
      <label className="block">Wearing all of (a set)<input className={input} disabled={readOnly} value={f.wornAll} onChange={(e) => setF({ ...f, wornAll: e.target.value })} /></label>
      <label className="block">Wearing any of<input className={input} disabled={readOnly} value={f.wornAny} onChange={(e) => setF({ ...f, wornAny: e.target.value })} /></label>
      <div className="flex flex-wrap gap-3">
        {(['melee', 'ranged', 'magic'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" disabled={readOnly} checked={f.kinds.includes(k)} onChange={(e) => setF({ ...f, kinds: e.target.checked ? [...f.kinds, k] : f.kinds.filter((x) => x !== k) })} /> {k}
          </label>
        ))}
        <label className="flex items-center gap-1">On task
          <Select value={f.onTask} disabled={readOnly} onChange={(v) => setF({ ...f, onTask: v })} ariaLabel="On task" className="w-24" options={[{ value: '', label: 'either' }, { value: 'yes', label: 'yes' }, { value: 'no', label: 'no' }]} />
        </label>
      </div>
      <label className="block">Target has any attribute<input className={input} disabled={readOnly} value={f.monsterAttributes} onChange={(e) => setF({ ...f, monsterAttributes: e.target.value })} placeholder="dragon, demon, undead, kalphite…" /></label>
      <label className="block">Target is one of<input className={input} disabled={readOnly} value={f.monsters} onChange={(e) => setF({ ...f, monsters: e.target.value })} placeholder="monster names" /></label>
      <p className="font-semibold text-text-muted">Then</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">Accuracy ×<input className={input} type="number" step="0.01" disabled={readOnly} value={f.accuracy} onChange={(e) => setF({ ...f, accuracy: Number(e.target.value) })} /></label>
        <label className="block">Damage ×<input className={input} type="number" step="0.01" disabled={readOnly} value={f.damage} onChange={(e) => setF({ ...f, damage: Number(e.target.value) })} /></label>
      </div>
      <label className="block">Note<input className={input} disabled={readOnly} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="source, e.g. the release news post" /></label>
      {!readOnly && (
        <div className="flex gap-2">
          <button onClick={save} className="rounded bg-gold px-3 py-1 font-semibold text-brown-dark hover:bg-gold-light">Save</button>
          {rule && <button onClick={() => revert('effect', rule.id).then(onDone)} className="rounded border border-red-900 px-3 py-1 text-red-300 hover:bg-red-950/40">Delete</button>}
        </div>
      )}
    </div>
  );
}
