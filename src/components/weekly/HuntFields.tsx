'use client';

import { useEffect, useRef, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import ChipsInput from '@/components/ChipsInput';
import Input from '@/components/Input';
import Radio from '@/components/Radio';
import Select from '@/components/Select';
import ThingIcon from '@/components/ThingIcon';
import { clanFetch } from '@/lib/clanFetch';
import { BOSSES, RAIDS_ANY_MODE, SKILLS, SKILL_LABELS, bossMetricLabel } from '@/lib/constants';
import { MAX_ENDING_DROPS, MAX_HUNT_ITEMS, type HuntConfirm, type HuntCountMode, type HuntEnding, type HuntRule, killsOfForItems } from '@/lib/itemHunt';
import NumberInput from '@/components/NumberInput';
import { PET_GROUPS } from '@/lib/petGroups';
import { itemIconUrl } from '@/lib/tileIcons';

/**
 * The item hunt half of the create form: what is hunted, where each item counts from, and the rule.
 * Posted as `hunt` to /api/admin/weekly, which checks it again (lib/itemHunt huntFromInput).
 */

export interface HuntFormItem {
  id: number;
  name: string;
  /** Sources the drop dataset lists for it: the choices offered. */
  known: string[];
  sources: string[];
  anySource: boolean;
  count: HuntCountMode;
}

export interface HuntFormValue {
  target: 'items' | 'pets';
  items: HuntFormItem[];
  petGroup: string;
  rule: HuntRule;
  ends: HuntEnding;
  confirm: HuntConfirm;
  /** "Any source" and pet hunts only: a boss whose kills the standings show. '' = none. */
  killsOf: string;
  /** XP gained in this skill, shown when there is no kill count. '' = none. */
  xpSkill: string;
}

export const DEFAULT_HUNT: HuntFormValue = { target: 'items', items: [], petGroup: 'all', rule: 'first', ends: { kind: 'date' }, confirm: 'staff', killsOf: '', xpSkill: '' };

/** What the form posts as `hunt`. */
export function huntPayload(v: HuntFormValue) {
  return {
    target: v.target,
    items: v.items.map((it) => ({ id: it.id, name: it.name, sources: it.anySource ? [] : it.sources, anySource: it.anySource, count: it.count })),
    petGroup: v.petGroup,
    rule: v.rule,
    ends: v.ends,
    confirm: v.confirm,
    killsOf: v.killsOf || null,
    xpSkill: v.xpSkill || null,
  };
}

/** An item still waiting for its "Counts from" choice, if any. The form refuses to submit on one. */
export function huntUnchosen(v: HuntFormValue): HuntFormItem | null {
  if (v.target !== 'items') return null;
  return v.items.find((it) => !it.anySource && it.sources.length === 0) ?? null;
}

interface SearchItem { id: number; name: string; sources: string[] }
interface SearchBoss { name: string; items: { id: number; name: string }[] }

const BOSS_OPTIONS = [
  { value: '', label: 'Do not show kills' },
  ...RAIDS_ANY_MODE.map((r) => ({ value: r.key, label: r.label, keywords: r.keywords })),
  ...BOSSES.map((b) => ({ value: b.key, label: b.label, keywords: b.aliases })),
];
const SKILL_OPTIONS = [
  { value: '', label: 'Do not show XP' },
  ...SKILLS.filter((s) => s !== 'overall').map((s) => ({ value: s, label: SKILL_LABELS[s] ?? s })),
];

export default function HuntFields({ value, onChange }: { value: HuntFormValue; onChange: (next: HuntFormValue) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ items: SearchItem[]; bosses: SearchBoss[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await clanFetch(`/api/admin/weekly/hunt-search?q=${encodeURIComponent(q)}`);
        if (res.ok && !cancelled) setResults(await res.json());
      } catch {
        /* the box simply shows nothing */
      }
      if (!cancelled) setSearching(false);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const set = (patch: Partial<HuntFormValue>) => onChange({ ...value, ...patch });
  const setItem = (id: number, patch: Partial<HuntFormItem>) => set({ items: value.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const has = (id: number) => value.items.some((it) => it.id === id);
  const full = value.items.length >= MAX_HUNT_ITEMS;

  /** Picked by name: one source is that source, several means the organiser has to choose. */
  function addByName(item: SearchItem) {
    if (has(item.id) || full) return;
    set({ items: [...value.items, { id: item.id, name: item.name, known: item.sources, sources: item.sources.length === 1 ? [...item.sources] : [], anySource: false, count: 'drops' }] });
    setQuery('');
    setOpen(false);
  }

  /** Picked while browsing a boss's drops: it counts from that boss. */
  function addFromBoss(boss: string, item: { id: number; name: string }) {
    if (has(item.id) || full) return;
    set({ items: [...value.items, { id: item.id, name: item.name, known: [boss], sources: [boss], anySource: false, count: 'drops' }] });
  }

  const shown = query.trim().length >= 2 ? results : null;
  const autoKills = value.target === 'items' ? killsOfForItems(value.items.map((it) => ({ id: it.id, name: it.name, sources: it.anySource ? [] : it.sources, count: it.count }))) : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">What are you hunting?</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Radio name="hunt-target" checked={value.target === 'items'} onChange={() => set({ target: 'items' })} />
            One or more items
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Radio name="hunt-target" checked={value.target === 'pets'} onChange={() => set({ target: 'pets' })} />
            Pets
          </label>
        </div>
      </div>

      {value.target === 'pets' ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">Which pets</label>
          <Select
            value={value.petGroup}
            onChange={(v) => set({ petGroup: v })}
            ariaLabel="Which pets count"
            options={PET_GROUPS.map((g) => ({ value: g.key, label: g.key === 'all' ? 'Any pet' : g.label }))}
          />
          <p className="mt-1.5 text-xs text-text-muted">
            {PET_GROUPS.find((g) => g.key === value.petGroup)?.blurb} A pet counts wherever it came from.
          </p>
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70" htmlFor="hunt-search">
            Items
          </label>
          <div ref={boxRef} className="relative">
            <Input
              id="hunt-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={full ? `That is the most a hunt can hold (${MAX_HUNT_ITEMS})` : 'Search an item, or a boss to browse its drops'}
              disabled={full}
              autoComplete="off"
              aria-label="Search an item or a boss"
            />
            {open && query.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-card-border bg-card-bg shadow-xl">
                {!shown && <p className="px-3 py-2 text-xs text-text-muted">{searching ? 'Searching…' : 'Type at least two letters.'}</p>}
                {shown && shown.items.length === 0 && shown.bosses.length === 0 && (
                  <p className="px-3 py-2 text-xs text-text-muted">Nothing found. Try the item&rsquo;s full name.</p>
                )}
                {shown?.bosses.map((b) => (
                  <div key={`b-${b.name}`} className="border-b border-card-border/60 px-3 py-2">
                    <p className="mb-1.5 text-[11px] uppercase tracking-widest text-text-muted">{b.name} drops</p>
                    <div className="flex flex-wrap gap-1.5">
                      {b.items.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          disabled={has(it.id)}
                          onClick={() => addFromBoss(b.name, it)}
                          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-card-border bg-brown-dark/40 px-2 py-1 text-xs hover:border-gold/50 disabled:opacity-40"
                        >
                          <ThingIcon src={itemIconUrl(it.id)} alt="" size={18} />
                          {it.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {shown?.items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    disabled={has(it.id)}
                    onClick={() => addByName(it)}
                    className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gold/10 disabled:opacity-40"
                  >
                    <ThingIcon src={itemIconUrl(it.id)} alt="" size={24} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{it.name}</span>
                      <span className="block truncate text-[11px] text-text-muted">
                        {it.sources.length === 0 ? 'No monster source listed' : `From ${it.sources.slice(0, 4).join(', ')}${it.sources.length > 4 ? ` and ${it.sources.length - 4} more` : ''}`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {value.items.length === 0 ? (
            <p className="mt-1.5 text-xs text-text-muted">Each item shows where it drops, so you can say which boss or activity it has to come from.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {value.items.map((it) => {
                const extra = it.sources.filter((s) => !it.known.some((k) => k.toLowerCase() === s.toLowerCase()));
                const unchosen = !it.anySource && it.sources.length === 0;
                return (
                  <li key={it.id} className={`rounded-lg border p-3 ${unchosen ? 'border-amber-400/60 bg-amber-400/[0.04]' : 'border-card-border bg-brown-dark/30'}`}>
                    <div className="flex items-center gap-2.5">
                      <ThingIcon src={itemIconUrl(it.id)} alt="" size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.name}</span>
                      <button
                        type="button"
                        onClick={() => set({ items: value.items.filter((x) => x.id !== it.id) })}
                        className="min-h-9 rounded px-2 text-xs text-text-muted hover:text-red-400"
                        aria-label={`Remove ${it.name}`}
                      >
                        Remove
                      </button>
                    </div>

                    <p className="mb-1.5 mt-2.5 text-xs font-medium text-foreground/70">Counts from</p>
                    {unchosen && (
                      <p className="mb-2 text-xs text-amber-300">
                        {it.known.length > 1 ? 'This drops in more than one place. Choose which count, or any source.' : 'Choose where it has to come from, or any source.'}
                      </p>
                    )}
                    <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                      {it.known.map((src) => (
                        <Checkbox
                          key={src}
                          checked={!it.anySource && it.sources.some((s) => s.toLowerCase() === src.toLowerCase())}
                          disabled={it.anySource}
                          onChange={(on) => setItem(it.id, { sources: on ? [...it.sources, src] : it.sources.filter((s) => s.toLowerCase() !== src.toLowerCase()) })}
                          label={src}
                          className="text-sm"
                        />
                      ))}
                      <Checkbox
                        checked={it.anySource}
                        onChange={(on) => setItem(it.id, { anySource: on })}
                        label="Any source"
                        description="Counts wherever it drops."
                        className="text-sm"
                      />
                    </div>
                    {!it.anySource && (
                      <div className="mt-2.5">
                        <p className="mb-1 text-[11px] text-text-muted">Somewhere else? Type the boss, monster or activity as the game names it.</p>
                        <ChipsInput
                          value={extra}
                          onChange={(tags) => setItem(it.id, { sources: [...it.sources.filter((s) => it.known.some((k) => k.toLowerCase() === s.toLowerCase())), ...tags] })}
                          placeholder="Add a source"
                          ariaLabel={`Other sources for ${it.name}`}
                          maxTagLength={60}
                        />
                      </div>
                    )}
                    <div className="mt-2.5 max-w-xs">
                      <Select
                        value={it.count}
                        onChange={(v) => setItem(it.id, { count: v === 'quantity' ? 'quantity' : 'drops' })}
                        ariaLabel={`How ${it.name} is counted`}
                        options={[
                          { value: 'drops', label: 'Count each drop once' },
                          { value: 'quantity', label: 'Count the quantity (stackables)' },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">Rule</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['first', 'First to get it', 'Whoever lands it first wins. Others are listed in the order they got it.'],
            ['most', 'Most by the end', 'The highest count when it ends wins. A tie goes to whoever got there first.'],
          ] as const).map(([key, label, blurb]) => (
            <label key={key} className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 ${value.rule === key ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
              <Radio name="hunt-rule" className="mt-0.5" checked={value.rule === key} onChange={() => set({ rule: key })} />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-text-muted">{blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <HuntEndingFields ends={value.ends} confirm={value.confirm} onChange={(patch) => set(patch)} />

      <div className="rounded-lg border border-card-border bg-brown-dark/30 p-3">
        <p className="text-sm font-medium text-foreground/70">Beside each player&rsquo;s count</p>
        {autoKills ? (
          <p className="mt-1 text-xs text-text-muted">
            Kills at {bossMetricLabel(autoKills)} since the hunt started, so you can see who is dry.
          </p>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Show kills at (optional)</label>
              <Select value={value.killsOf} onChange={(v) => set({ killsOf: v, xpSkill: v ? '' : value.xpSkill })} ariaLabel="Show kills at" options={BOSS_OPTIONS} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Also show XP gained in (optional)</label>
              <Select value={value.xpSkill} onChange={(v) => set({ xpSkill: v })} ariaLabel="Also show XP gained in" options={SKILL_OPTIONS} disabled={!!value.killsOf} />
            </div>
            <p className="text-xs text-text-muted sm:col-span-2">
              {value.target === 'items'
                ? 'These sources have no kill count on the hiscores, so nothing is shown unless you pick one. Leave both empty to show only the drops.'
                : 'Pick a boss for a boss pet, or a skill for a skilling pet. Leave both empty to show only the pets.'}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Drops count from the Anvil plugin, or from a screenshot with the kill count or XP that staff approve. Everyone on the roster is
        entered when it starts; there is no board, no teams and no sign-up.
      </p>
    </div>
  );
}

/**
 * "How it ends" and "Who confirms drops". On the create form and on a running hunt's Settings, so
 * one description of each choice serves both.
 */
export function HuntEndingFields({
  ends,
  confirm,
  onChange,
  name = 'hunt',
}: {
  ends: HuntEnding;
  confirm: HuntConfirm;
  onChange: (patch: { ends?: HuntEnding; confirm?: HuntConfirm }) => void;
  /** Radio group prefix, for a page that shows this more than once. */
  name?: string;
}) {
  const n = ends.kind === 'drops' ? ends.n : 1;
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">How it ends</p>
        <div className="space-y-2">
          <label className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 ${ends.kind === 'date' ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
            <Radio name={`${name}-ends`} className="mt-0.5" checked={ends.kind === 'date'} onChange={() => onChange({ ends: { kind: 'date' } })} />
            <span>
              <span className="block text-sm font-medium">At the end date</span>
              <span className="block text-xs text-text-muted">It runs the whole time and lists everyone who got one, in order.</span>
            </span>
          </label>
          <div className={`rounded-lg border p-3 ${ends.kind === 'drops' ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
            <label className="flex cursor-pointer gap-2.5">
              <Radio name={`${name}-ends`} className="mt-0.5" checked={ends.kind === 'drops'} onChange={() => onChange({ ends: { kind: 'drops', n, by: 'all' } })} />
              <span>
                <span className="block text-sm font-medium">After a number of drops</span>
                <span className="block text-xs text-text-muted">It ends early once enough have landed. One drop means it ends when the first one lands.</span>
              </span>
            </label>
            {ends.kind === 'drops' && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
                <span className="flex items-center gap-2 text-sm">
                  End after
                  <NumberInput value={ends.n} onChange={(v) => onChange({ ends: { ...ends, n: v } })} min={1} max={MAX_ENDING_DROPS} fallback={1} className="w-20" aria-label="Number of drops" />
                  {ends.n === 1 ? 'drop' : 'drops'}
                </span>
                <Checkbox
                  checked={ends.by === 'player'}
                  onChange={(on) => onChange({ ends: { ...ends, by: on ? 'player' : 'all' } })}
                  label="By one player"
                  description="Off: counted across everyone."
                  className="text-sm"
                />
              </div>
            )}
          </div>
          <p className="text-xs text-text-muted">Staff can also end it by hand at any time, from the hunt&rsquo;s page: End now and post results.</p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">Who confirms drops</p>
        <div className="space-y-2">
          <label className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 ${confirm === 'staff' ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
            <Radio name={`${name}-confirm`} className="mt-0.5" checked={confirm === 'staff'} onChange={() => onChange({ confirm: 'staff' })} />
            <span>
              <span className="block text-sm font-medium">Staff confirm each drop that decides the result</span>
              <span className="block text-xs text-text-muted">
                Drops show in the standings as they arrive. An early ending, and any prizes, wait until staff have confirmed the drops they rest on.
              </span>
            </span>
          </label>
          <label className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 ${confirm === 'auto' ? 'border-amber-400/60 bg-amber-400/[0.05]' : 'border-card-border bg-brown-dark/30'}`}>
            <Radio name={`${name}-confirm`} className="mt-0.5" checked={confirm === 'auto'} onChange={() => onChange({ confirm: 'auto' })} />
            <span>
              <span className="block text-sm font-medium">Count plugin drops automatically</span>
              <span className="block text-xs text-text-muted">
                Plugin reports are not checked by Anvil. Use this only when no prize depends on it, or you trust your members. A report that looks
                wrong still waits for staff, and a screenshot proof always needs approval.
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
