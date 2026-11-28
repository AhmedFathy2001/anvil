'use client';

import { useMemo, useState } from 'react';

import ChipsInput from '@/components/ChipsInput';
import Checkbox from '@/components/Checkbox';
import DialogFrame from '@/components/DialogFrame';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { CA_RULES, caName } from '@/lib/loadout/caRules';
import Textarea from '@/components/Textarea';
import type { GearIndex } from '@/lib/dps/summary';
import type { GearSetup } from '@/lib/guideTiers';
import { GUIDE_ACCOUNTS, GUIDE_BUILDS } from '@/lib/guideSetups';
import { markerCountLabel, parseGroundMarkers } from '@/lib/groundMarkers';
import { parseRuneliteImport, tagToSetup, type ImportedTag } from '@/lib/runeliteImport';
import type { EquipSlot } from '@/lib/runeliteExport';
import { parseYouTube } from '@/lib/youtube';
import { ItemSprite, type Names } from './osrs';
import { SLOT_NAME } from '@/lib/slotNames';

const SLOTS = ['head', 'cape', 'neck', 'ammo', 'quiver', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'] as const;
const SPELLS = ['Crumble Undead', 'Teleport to House', 'Vengeance', 'Ice Barrage', 'Blood Barrage', 'Fire Surge', 'Fire Wave', 'Iban Blast', 'Saradomin Strike', 'Thrall', 'Death Charge', 'Mark of Darkness', 'Resurrect Greater Ghost', 'Superior Ghost', 'Lunar teleport', 'Cure Me', 'Spellbook Swap'];
/** "CA: …" on the pill: the tasks the trip card knows (they change a loadout), by name. */
const CA_OPTIONS = [{ value: '', label: 'None' }, ...CA_RULES.map((r) => ({ value: String(r.id), label: caName(r.id) ?? '' })).filter((o) => o.label).sort((a, b) => a.label.localeCompare(b.label))];
const LEVEL_SKILLS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer', 'hitpoints', 'slayer', 'agility'];

const chip = (on: boolean) => `h-8 rounded-full border px-3 text-xs ${on ? 'border-gold bg-gold font-semibold text-brown-dark' : 'border-card-border bg-card-bg hover:border-gold/50'}`;

/**
 * Everything a setup carries beyond its gear and stats: who it is for (account types, builds),
 * minimum levels and quests, a chip, the curator star, spells, fallbacks per slot (best first, drag
 * to reorder), steps (YouTube links and images allowed — pasted links become embeds on the page),
 * a Ground Markers paste box, and "Import bank tag / Inventory Setup". Used by the library editor's
 * gear builder and by the community submit form alike.
 */
export default function SetupExtrasEditor({
  value,
  onChange,
  idx,
  names,
  curator = false,
}: {
  value: GearSetup;
  onChange: (patch: Partial<GearSetup>) => void;
  idx: GearIndex;
  names: Names;
  /** Shows the "curator pick" star toggle. */
  curator?: boolean;
}) {
  const [markersText, setMarkersText] = useState(value.markers?.length ? JSON.stringify(value.markers) : '');
  const markers = useMemo(() => parseGroundMarkers(markersText), [markersText]);
  const [importOpen, setImportOpen] = useState(false);
  const [stepsText, setStepsText] = useState((value.steps ?? []).join('\n'));
  const toggle = (list: string[] | undefined, k: string) => ((list ?? []).includes(k) ? (list ?? []).filter((x) => x !== k) : [...(list ?? []), k]);
  const nameOf = (id: number) => idx.item(id)?.n ?? names[id] ?? `Item ${id}`;

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-2">
        <div className="font-semibold">Account types <span className="font-normal text-text-muted">(pick all that fit; none = all)</span></div>
        <div className="flex flex-wrap gap-1.5">
          {GUIDE_ACCOUNTS.map((a) => (
            <button key={a.key} type="button" aria-pressed={(value.accounts ?? []).includes(a.key)} onClick={() => onChange({ accounts: toggle(value.accounts, a.key) })} className={chip((value.accounts ?? []).includes(a.key))}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="font-semibold">Build</div>
        <div className="flex flex-wrap gap-1.5">
          {GUIDE_BUILDS.filter((b) => b.key !== 'any').map((b) => (
            <button key={b.key} type="button" aria-pressed={(value.builds ?? []).includes(b.key)} onClick={() => onChange({ builds: toggle(value.builds, b.key) })} className={chip((value.builds ?? []).includes(b.key))}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="font-semibold">Chip on the pill</span>
          <Input value={value.tag ?? ''} onChange={(e) => onChange({ tag: e.target.value.slice(0, 20) || undefined })} placeholder="Budget, Iron-friendly…" />
        </label>
        <label className="block space-y-1">
          <span className="font-semibold">Combat Achievement variant</span>
          <Select value={value.ca != null ? String(value.ca) : ''} onChange={(v) => onChange({ ca: v ? Number(v) : undefined })} options={CA_OPTIONS} ariaLabel="Combat Achievement this setup is for" searchable />
        </label>
        {curator && (
          <div className="flex items-end pb-2">
            <Checkbox checked={!!value.pick} onChange={(v) => onChange({ pick: v || undefined })} label="Curator pick (starred, opens first when it fits)" />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="font-semibold">Minimum levels and quests</div>
        <div className="flex flex-wrap gap-2">
          {LEVEL_SKILLS.map((sk) => (
            <label key={sk} className="flex items-center gap-1">
              <span className="w-14 capitalize text-text-muted">{sk}</span>
              <Input
                inputMode="numeric"
                value={value.req?.levels?.[sk] ?? ''}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0));
                  const levels = { ...(value.req?.levels ?? {}) };
                  if (n) levels[sk] = n;
                  else delete levels[sk];
                  onChange({ req: { ...value.req, levels } });
                }}
                className="h-7 w-12 px-1 py-0 text-center text-xs"
              />
            </label>
          ))}
        </div>
        <ChipsInput value={value.req?.quests ?? []} onChange={(quests) => onChange({ req: { ...value.req, quests: quests.slice(0, 5) } })} placeholder="Quests needed (Enter to add)" ariaLabel="Quests" />
      </div>

      <div className="space-y-1.5">
        <div className="font-semibold">Spells the setup needs</div>
        <ChipsInput value={value.spells ?? []} onChange={(spells) => onChange({ spells: spells.slice(0, 6) })} suggestions={SPELLS} placeholder="Crumble Undead…" ariaLabel="Spells" />
      </div>

      {[28951, 28947, 28902].includes(value.gear.cape ?? 0) && <QuiverPicker value={value} onChange={onChange} idx={idx} nameOf={nameOf} />}

      <FallbackEditor value={value} onChange={onChange} idx={idx} nameOf={nameOf} />

      <div className="space-y-1.5">
        <div className="font-semibold">Steps <span className="font-normal text-text-muted">(one per line · paste a YouTube link to embed it · static text only, no timers)</span></div>
        <Textarea
          rows={5}
          value={stepsText}
          onChange={(e) => {
            setStepsText(e.target.value);
            onChange({ steps: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12) });
          }}
          placeholder={'Drink Divine ranging before you start.\nAcid phase: walk two clean tiles back and forth.\nhttps://youtu.be/…?t=42'}
        />
        {(value.steps ?? []).some((s) => /youtu/.test(s) && !s.split(/\s+/).some((t) => parseYouTube(t))) && <p className="text-amber-200">That YouTube link isn&apos;t one we can embed.</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 font-semibold">
          Tile markers
          {markers.ok && markers.points.length > 0 && <span className="rounded-full bg-emerald-900/40 px-2 text-emerald-300">{markerCountLabel(markers.points.length)} ✓</span>}
        </div>
        <Textarea
          rows={2}
          value={markersText}
          onChange={(e) => {
            setMarkersText(e.target.value);
            const r = parseGroundMarkers(e.target.value);
            if (r.ok) onChange({ markers: r.points.length ? r.points : undefined });
          }}
          placeholder='[{"regionId":9023,"regionX":34,"regionY":21,"z":0,"color":"#FFE0B453"}]'
          className="font-mono text-[11px]"
        />
        {!markers.ok ? <p className="text-red-300">{markers.error}</p> : <p className="text-text-muted">Paste your Ground Markers export (RuneLite: right-click the world map orb → Export Ground Markers). Players copy them with one button.</p>}
      </div>

      <button type="button" onClick={() => setImportOpen(true)} className="rounded-lg border border-card-border px-3 py-1.5 hover:border-gold/50">
        Import bank tag / Inventory Setup
      </button>
      {importOpen && (
        <ImportDialog
          names={names}
          hasContent={Object.keys(value.gear).length > 0 || !!value.inventory?.some(Boolean)}
          onUse={(tag) => {
            const s = tagToSetup(tag, (id) => {
              const slot = idx.item(id)?.s;
              return slot && slot !== '2h' ? (slot as EquipSlot) : slot === '2h' ? 'weapon' : null;
            });
            onChange({ gear: s.gear as Record<string, number>, inventory: s.inventory, runePouch: s.runePouch.length ? s.runePouch : value.runePouch, ...(s.spellbook != null ? { spellbook: s.spellbook } : {}) });
          }}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}

/** Dizana's quiver's second ammo slot (drawn above Ammo on the paper doll). */
function QuiverPicker({ value, onChange, idx, nameOf }: { value: GearSetup; onChange: (p: Partial<GearSetup>) => void; idx: GearIndex; nameOf: (id: number) => string }) {
  const [q, setQ] = useState('');
  const matches = q.trim().length < 2 ? [] : idx.items.filter((it) => !it.hid && it.s === 'ammo' && it.n.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 10);
  return (
    <div className="space-y-1">
      <div className="font-semibold">Quiver ammo <span className="font-normal text-text-muted">(Dizana&apos;s quiver&apos;s second ammo slot)</span></div>
      {value.quiver ? (
        <span className="inline-flex items-center gap-1.5 rounded border border-card-border px-2 py-1">
          <ItemSprite id={value.quiver} name={nameOf(value.quiver)} size={22} /> {nameOf(value.quiver)}
          <button type="button" onClick={() => onChange({ quiver: null })} className="text-text-muted hover:text-red-300" aria-label="Clear quiver ammo">
            ×
          </button>
        </span>
      ) : (
        <>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ammo, e.g. Diamond dragon bolts (e)" className="h-8 text-xs" />
          <div className="flex flex-wrap gap-1">
            {matches.map((it) => (
              <button key={it.id} type="button" onClick={() => onChange({ quiver: it.id })} className="flex items-center gap-1 rounded border border-card-border px-1.5 py-0.5 hover:border-gold/50">
                <ItemSprite id={it.id} name={it.n} size={18} /> {it.n}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Per-slot fallbacks, best first: "+ Add fallback", drag (or the arrows) to reorder. */
function FallbackEditor({ value, onChange, idx, nameOf }: { value: GearSetup; onChange: (p: Partial<GearSetup>) => void; idx: GearIndex; nameOf: (id: number) => string }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState<{ slot: string; i: number } | null>(null);
  const alts = value.alts ?? {};
  const setSlot = (slot: string, list: number[]) => onChange({ alts: { ...alts, [slot]: list.length ? list : undefined } });
  const matches = useMemo(() => {
    if (!adding || q.trim().length < 2) return [];
    const needle = q.trim().toLowerCase();
    const want = adding === 'quiver' ? 'ammo' : adding;
    return idx.items.filter((it) => !it.hid && (it.s === want || (want === 'weapon' && it.s === '2h')) && it.n.toLowerCase().includes(needle)).slice(0, 12);
  }, [adding, q, idx.items]);
  const slots = SLOTS.filter((s) => (s === 'quiver' ? value.quiver : value.gear[s]));
  if (!slots.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="font-semibold">Fallbacks <span className="font-normal text-text-muted">(players who don&apos;t own the first item get the next one they own)</span></div>
      <div className="space-y-1">
        {slots.map((slot) => {
          const first = slot === 'quiver' ? value.quiver! : value.gear[slot];
          const list = alts[slot] ?? [];
          return (
            <div key={slot} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-card-border bg-black/20 p-1.5">
              <span className="w-14 text-text-muted">{SLOT_NAME[slot]}</span>
              <span className="flex items-center gap-1">
                <ItemSprite id={first} name={nameOf(first)} size={22} /> {nameOf(first)}
              </span>
              {list.map((id, i) => (
                <span
                  key={id}
                  draggable
                  onDragStart={() => setDrag({ slot, i })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!drag || drag.slot !== slot) return;
                    const next = [...list];
                    const [m] = next.splice(drag.i, 1);
                    next.splice(i, 0, m);
                    setSlot(slot, next);
                    setDrag(null);
                  }}
                  className="flex cursor-grab items-center gap-1 rounded border border-card-border bg-card-bg px-1 py-0.5"
                  title="Drag to reorder"
                >
                  <span className="text-text-muted">→</span>
                  <ItemSprite id={id} name={nameOf(id)} size={20} />
                  {nameOf(id)}
                  <button type="button" aria-label={`Move ${nameOf(id)} earlier`} disabled={i === 0} onClick={() => { const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setSlot(slot, n); }} className="px-0.5 text-text-muted disabled:opacity-30">
                    ‹
                  </button>
                  <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => setSlot(slot, list.filter((x) => x !== id))} className="px-0.5 text-text-muted hover:text-red-300">
                    ×
                  </button>
                </span>
              ))}
              {list.length < 5 && (
                <button type="button" onClick={() => { setAdding(slot); setQ(''); }} className="rounded border border-dashed border-card-border px-1.5 py-0.5 text-text-muted hover:text-gold">
                  + Add fallback
                </button>
              )}
              {adding === slot && (
                <div className="w-full space-y-1">
                  <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${SLOT_NAME[slot].toLowerCase()} items…`} className="h-8 text-xs" />
                  <div className="flex flex-wrap gap-1">
                    {matches.map((it) => (
                      <button key={it.id} type="button" onClick={() => { setSlot(slot, [...list, it.id].filter((x, k, a) => x !== first && a.indexOf(x) === k)); setAdding(null); }} className="flex items-center gap-1 rounded border border-card-border px-1.5 py-0.5 hover:border-gold/50">
                        <ItemSprite id={it.id} name={it.n} size={18} /> {it.n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Paste a bank tag or an Inventory Setup, see it as the bank shows it, then use it. */
function ImportDialog({ names, hasContent, onUse, onClose }: { names: Names; hasContent: boolean; onUse: (t: ImportedTag) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const r = text.trim() ? parseRuneliteImport(text) : null;
  return (
    <DialogFrame dirty={!!text} onClose={onClose} overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" panelClassName="w-full max-w-xl rounded-xl border border-card-border bg-card-bg p-5" ariaLabel="Import bank tag or Inventory Setup">
      {(close) => (
        <div className="space-y-3 text-sm">
          <h2 className="text-lg font-bold">Import bank tag / Inventory Setup</h2>
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="banktags,1,… or the Inventory Setups export" className="font-mono text-[11px]" />
          {r && !r.ok && <p className="text-xs text-red-300">{r.error}</p>}
          {r?.ok && (
            <div className="space-y-2 overflow-x-auto">
              <PreviewLayout tag={r.tag} names={names} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-lg border border-card-border px-3 py-2">
              Cancel
            </button>
            <button
              type="button"
              disabled={!r?.ok}
              onClick={() => {
                if (!r?.ok) return;
                if (hasContent && !window.confirm('Replace this setup’s gear and inventory with the import?')) return;
                onUse(r.tag);
                close();
              }}
              className="rounded-lg bg-gold px-4 py-2 font-semibold text-brown-dark disabled:opacity-40"
            >
              Use as setup
            </button>
          </div>
        </div>
      )}
    </DialogFrame>
  );
}

/** The imported tag's own layout, 8 per row. */
function PreviewLayout({ tag, names }: { tag: ImportedTag; names: Names }) {
  const last = tag.layout.size ? Math.max(...tag.layout.keys()) : -1;
  const cells = Array.from({ length: Math.ceil((last + 1) / 8) * 8 }, (_, i) => tag.layout.get(i) ?? null);
  return (
    <div className="inline-block overflow-hidden rounded border border-[#14100b] bg-[#3e3529]">
      <div className="flex items-center gap-2 border-b border-[#14100b] bg-[#2f2820] px-2 py-1">
        {tag.icon ? <ItemSprite id={tag.icon} name={names[tag.icon]} size={26} /> : null}
        <span className="text-xs font-semibold text-[#ff981f]">{tag.name}</span>
      </div>
      <div className="grid grid-cols-8 gap-x-[6px] gap-y-[2px] p-2">
        {cells.map((id, i) => (
          <span key={i} className="flex h-8 w-9 items-center justify-center">
            {id ? <ItemSprite id={id} name={names[id]} size={30} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
