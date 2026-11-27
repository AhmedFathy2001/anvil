'use client';

import { useEffect, useRef, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import ChipsInput from '@/components/ChipsInput';
import Input from '@/components/Input';
import Radio from '@/components/Radio';
import Select from '@/components/Select';
import ThingIcon from '@/components/ThingIcon';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import { clanFetch } from '@/lib/clanFetch';
import { BOSSES, RAIDS_ANY_MODE, SKILLS, SKILL_LABELS, metricKeys } from '@/lib/constants';
import { parseTypedHunt, type TypedHunt } from '@/lib/huntTyped';
import { decodeStat, encodeStat, huntFormRow, type HuntFormItem, type HuntFormValue } from '@/lib/huntForm';
import {
  DEFAULT_BOUNTY_TAPER,
  MAX_BOUNTY_PLACES,
  MAX_ENDING_DROPS,
  MAX_HUNT_ITEMS,
  MAX_HUNT_ROWS,
  MAX_ITEM_POINTS,
  type HuntConfirm,
  type HuntEnding,
  autoRowStat,
  rowStatLabel,
  taperBounty,
} from '@/lib/itemHunt';
import NumberInput from '@/components/NumberInput';
import { PET_GROUPS } from '@/lib/petGroups';
import { itemIconUrl } from '@/lib/tileIcons';
import { MAX_WEEKLY_PLACES } from '@/lib/weeklyPrizes';
import { MAX_RUSH_POINTS, MAX_RUSH_TARGETS, MAX_SYNERGY, RUSH_RAID_TARGETS, type RushRules, rarityWords } from '@/lib/bossRushRules';

/**
 * The item hunt half of the create form: one list of what is hunted (a pet is just another row),
 * each row's source, count, points and "Closest to it" stat, then the rule, the ending and the
 * prizes. Posted as `hunt` (a v2 config) to /api/admin/weekly, which checks it again
 * (lib/itemHunt huntFromInput).
 */

// The form's value and what it posts live in lib/huntForm, so a server page can build one too.
export { DEFAULT_HUNT, decodeStat, encodeStat, huntFormRow, huntPayload, huntPrizesPayload, huntUnchosen } from '@/lib/huntForm';
export type { HuntFormItem, HuntFormValue } from '@/lib/huntForm';

interface SearchItem { id: number; name: string; sources: string[] }
interface SearchBoss { name: string; items: { id: number; name: string }[] }
interface SearchPet { id: number; name: string }
type SearchResult = { items: SearchItem[]; bosses: SearchBoss[]; pets?: SearchPet[] };

const STAT_OPTIONS = [
  { value: '', label: 'Nothing' },
  ...RAIDS_ANY_MODE.map((r) => ({ value: `boss:${r.key}`, label: `${r.label.replace(/\s*\(any mode\)$/i, '')} kills`, keywords: r.keywords })),
  ...BOSSES.map((b) => ({ value: `boss:${b.key}`, label: `${b.label} kills`, keywords: b.aliases })),
  ...SKILLS.filter((s) => s !== 'overall').map((s) => ({ value: `skill:${s}`, label: `${SKILL_LABELS[s] ?? s} XP` })),
];

/** The options for one row: the list, plus the row's own pick when it is a set no single entry is ("Callisto + Artio"). */
function statOptions(current: string) {
  if (!current || STAT_OPTIONS.some((o) => o.value === current)) return STAT_OPTIONS;
  return [{ value: current, label: rowStatLabel(decodeStat(current)) ?? current }, ...STAT_OPTIONS];
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

/** "1 in 5,000" for a row's stat, from the drop dataset's rates; or why there is none. */
function rateWords(it: HuntFormItem, rates: Record<string, number> | undefined): string | null {
  const stat = decodeStat(it.stat);
  if (!stat) return null;
  if (stat.type === 'skill') return 'No XP-based drop rate: shows the XP only';
  if (!rates) return null;
  const known = metricKeys(stat.metric).filter((k) => rates[k]);
  if (known.length === 0) return 'No drop rate here: shows the kills only';
  if (known.length === 1) return `1 in ${rates[known[0]].toLocaleString()}`;
  return known.map((k) => `1 in ${rates[k].toLocaleString()} at ${BOSSES.find((b) => b.key === k)?.label ?? k}`).join(', ');
}

async function searchHunt(q: string): Promise<SearchResult | null> {
  try {
    const res = await clanFetch(`/api/admin/weekly/hunt-search?q=${encodeURIComponent(q)}`);
    return res.ok ? ((await res.json()) as SearchResult) : null;
  } catch {
    return null;
  }
}

export default function HuntFields({
  value,
  onChange,
  prizes = false,
  kind,
}: {
  value: HuntFormValue;
  onChange: (next: HuntFormValue) => void;
  prizes?: boolean;
  /** 'rush': the Boss Rush card, kept on its rule. 'hunt': the Item hunt card, without it. Absent (editing one): whichever it is. */
  kind?: 'rush' | 'hunt';
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Drop rates by item id, then hiscores boss key (api/admin/weekly/hunt-rates): only what the drop dataset has.
  const [rates, setRates] = useState<Record<number, Record<string, number>>>({});
  const [typed, setTyped] = useState('');
  const [typedNote, setTypedNote] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchHunt(q);
      if (!cancelled) {
        if (r) setResults(r);
        setSearching(false);
      }
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

  const missingRates = value.items.filter((it) => !(it.id in rates)).map((it) => it.id);
  const missingKey = missingRates.join(',');
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await clanFetch(`/api/admin/weekly/hunt-rates?ids=${missingKey}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { rates?: Record<string, Record<string, number>> };
        setRates((prev) => {
          const next = { ...prev };
          for (const id of missingKey.split(',').map(Number)) next[id] = data.rates?.[id] ?? {};
          return next;
        });
      } catch {
        /* the rows simply show no rate */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  const set = (patch: Partial<HuntFormValue>) => onChange({ ...value, ...patch });
  const setItem = (id: number, patch: Partial<HuntFormItem>) =>
    set({
      items: value.items.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        // An item's own pick follows its sources until somebody chooses one by hand.
        if (next.statAuto && !next.pet && (patch.sources || patch.anySource !== undefined)) {
          next.stat = encodeStat(autoRowStat({ id: next.id, name: next.name, sources: next.anySource ? [] : next.sources }));
        }
        return next;
      }),
    });
  const has = (id: number) => value.items.some((it) => it.id === id);
  const items = value.items.filter((it) => !it.pet).length;
  const fullRows = value.items.length >= MAX_HUNT_ROWS;
  const rush = value.rule === 'rush';
  // A rush lists a boss's whole log page, so only the row cap holds it: its items are what the plugin reports anyway.
  const fullItems = !rush && items >= MAX_HUNT_ITEMS;

  function add(rows: HuntFormItem[], base: HuntFormItem[] = value.items) {
    const next = [...base];
    let itemCount = items;
    for (const r of rows) {
      if (next.length >= MAX_HUNT_ROWS || next.some((x) => x.id === r.id)) continue;
      if (!rush && !r.pet && itemCount >= MAX_HUNT_ITEMS) continue;
      if (!r.pet) itemCount++;
      next.push(r);
    }
    return next;
  }

  /** Picked by name: one source is that source, several means the organiser has to choose. */
  function addByName(item: SearchItem) {
    set({ items: add([huntFormRow({ id: item.id, name: item.name, known: item.sources, sources: item.sources.length === 1 ? [...item.sources] : [] })]) });
    setQuery('');
    setOpen(false);
  }

  /** Picked while browsing a boss's drops: it counts from that boss. */
  function addFromBoss(boss: string, item: { id: number; name: string }) {
    set({ items: add([huntFormRow({ id: item.id, name: item.name, known: [boss], sources: [boss] })]) });
  }

  function addPet(p: SearchPet) {
    set({ items: add([huntFormRow({ ...p, pet: true })]) });
    setQuery('');
    setOpen(false);
  }

  /** A whole group's pets as rows, to trim. */
  function addGroup(key: string) {
    const group = PET_GROUPS.find((g) => g.key === key);
    if (group) set({ items: add(group.items.map((p) => huntFormRow({ ...p, pet: true }))) });
  }

  const read: TypedHunt | null = typed.trim() ? parseTypedHunt(typed) : null;

  /**
   * "Use this": the typed line becomes rows, ending and places. A pet is known already; an item is
   * looked up by the same search the box below uses and taken only when one result has that name
   * (or the search finds just the one), so a word that matches nothing is said, not guessed at.
   */
  async function applyTyped() {
    if (!read) return;
    setApplying(true);
    setTypedNote('');
    const rows: HuntFormItem[] = [];
    const missed: string[] = [];
    for (const r of read.rows) {
      if (r.pet) {
        rows.push(huntFormRow({ ...r.pet, pet: true, points: r.points ?? 1 }));
        continue;
      }
      const found = await searchHunt(r.query);
      const exact = found?.items.find((i) => i.name.toLowerCase() === r.query.toLowerCase()) ?? (found?.items.length === 1 ? found.items[0] : null);
      const pet = !exact ? (found?.pets?.find((p) => p.name.toLowerCase() === r.query.toLowerCase()) ?? null) : null;
      if (exact) rows.push(huntFormRow({ id: exact.id, name: exact.name, known: exact.sources, sources: exact.sources.length === 1 ? [...exact.sources] : [], points: r.points ?? 1 }));
      else if (pet) rows.push(huntFormRow({ ...pet, pet: true, points: r.points ?? 1 }));
      else missed.push(r.query);
    }
    for (const key of read.groups) rows.push(...(PET_GROUPS.find((g) => g.key === key)?.items ?? []).map((p) => huntFormRow({ ...p, pet: true })));
    // Points typed for a row that is already on the list change it there.
    const typedPoints = new Map(read.rows.some((r) => r.points != null) ? rows.map((r) => [r.id, r.points]) : []);
    const nextItems = add(rows).map((it) => (typedPoints.has(it.id) ? { ...it, points: typedPoints.get(it.id) ?? it.points } : it));
    const places = read.places;
    onChange({
      ...value,
      items: nextItems,
      rule: read.rule ?? value.rule,
      ends: read.endsAll ? { kind: 'all' } : value.ends,
      prizes: places == null ? value.prizes : Array.from({ length: places }, (_, i) => value.prizes[i] ?? 0),
    });
    setTypedNote(missed.length > 0 ? `Not found: ${missed.join(', ')}. Search for ${missed.length === 1 ? 'it' : 'them'} below.` : '');
    setApplying(false);
  }

  const [rushNote, setRushNote] = useState('');

  /** Targets picked for the rush: each one's notable drops join the list with no points yet. */
  async function addRushTargets(names: string[]) {
    const have = new Set(value.rush.targets.map((t) => t.toLowerCase()));
    const wanted = names.filter((n, i) => n && !have.has(n.toLowerCase()) && names.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i).slice(0, MAX_RUSH_TARGETS - value.rush.targets.length);
    if (wanted.length === 0) return;
    // The targets go in at once, so a quick second pick is not lost to the drops still loading.
    const targets = [...value.rush.targets, ...wanted];
    // One target at a time, so a drop two of them share knows both as where it counts from.
    const per = new Map<string, { id: number; name: string; sources: string[]; pet: boolean; rate: number | null }[]>();
    await Promise.all(
      wanted.map(async (t) => {
        try {
          const res = await clanFetch(`/api/admin/weekly/rush-drops?targets=${encodeURIComponent(t)}`);
          if (res.ok) per.set(t, (await res.json()).drops ?? []);
        } catch {
          /* the target still counts; its drops can be added by hand */
        }
      }),
    );
    const none = wanted.filter((t) => !(per.get(t)?.length));
    setRushNote(none.length ? `No notable drops listed for ${none.join(', ')}: add any with the search below.` : '');
    let items = value.items;
    for (const t of wanted) {
      const drops = per.get(t) ?? [];
      // Already listed (another target drops it too): it now also counts from here.
      items = items.map((it) => {
        const d = drops.find((x) => x.id === it.id);
        if (!d || !it.rushFrom) return it;
        return { ...it, rushFrom: [...it.rushFrom, t], sources: [...new Set([...it.sources, ...d.sources])], known: [...new Set([...it.known, ...d.sources])] };
      });
      const fresh = drops
        .filter((d) => !items.some((it) => it.id === d.id))
        .map((d) => ({ ...huntFormRow({ id: d.id, name: d.name, known: d.sources, sources: d.sources, pet: d.pet, points: 0 }), rushFrom: [t], rate: d.rate, stat: '', statAuto: false }));
      items = add(fresh, items);
    }
    onChange({ ...value, rush: { ...value.rush, targets }, items });
  }

  /** A target taken off the rush: the drops only it brought go with it. Rows added by hand stay. */
  function removeRushTarget(name: string) {
    const items = value.items.flatMap((it) => {
      if (!it.rushFrom?.includes(name)) return [it];
      const rest = it.rushFrom.filter((k) => k !== name);
      return rest.length === 0 ? [] : [{ ...it, rushFrom: rest }];
    });
    set({ rush: { ...value.rush, targets: value.rush.targets.filter((t) => t !== name) }, items });
  }

  const setRush = (patch: Partial<RushRules>) => set({ rush: { ...value.rush, ...patch } });
  const unpriced = rush ? value.items.filter((it) => it.points <= 0).length : 0;

  function scrollToRow(id: number) {
    document.getElementById(`hunt-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const shown = query.trim().length >= 2 ? results : null;
  const rowCount = value.items.length;

  return (
    <div className="space-y-4">
      {/* Boss Rush is its own card: no rule to pick. An item hunt picks among the other three. */}
      {!(kind === 'rush' || (kind == null && rush)) && (
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">Rule</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ['first', 'First to get one', 'Any of them counts. Others are listed in the order they got one.'],
            ['most', 'Most by the end', 'The highest count wins. A tie goes to whoever got there first.'],
            ['points', 'Most points', 'Each row is worth the points you give it.'],
          ] as const).map(([key, label, blurb]) => (
            <label key={key} className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${value.rule === key ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
              <Radio name="hunt-rule" checked={value.rule === key} onChange={() => set({ rule: key })} />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-text-muted">{blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      )}

      {rush && (
        <RushFields
          targets={value.rush.targets}
          rules={value.rush}
          onAdd={(names) => void addRushTargets(names)}
          onRemove={removeRushTarget}
          onRules={setRush}
          note={rushNote}
        />
      )}

      {!rush && (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/70" htmlFor="hunt-typed">
          Type it
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="hunt-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void applyTyped();
              }
            }}
            placeholder="graardor pet 5, heron 3, bandos chestplate 1, all of them, top 3"
            autoComplete="off"
            className="min-h-11 flex-1 basis-72"
          />
          <button
            type="button"
            onClick={() => void applyTyped()}
            disabled={!read || applying}
            className="min-h-11 rounded-lg border border-gold/40 px-4 text-sm font-semibold text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {applying ? 'Reading…' : 'Use this'}
          </button>
        </div>
        {read && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Reads as">
            {read.rows.map((r, i) => {
              const on = r.pet ? value.items.find((it) => it.id === r.pet?.id) : value.items.find((it) => it.name.toLowerCase() === r.query.toLowerCase());
              return (
                <button
                  key={`${r.query}-${i}`}
                  type="button"
                  onClick={() => on && scrollToRow(on.id)}
                  disabled={!on}
                  className="min-h-9 rounded-full border border-card-border bg-brown-dark/40 px-3 text-xs text-foreground/90 enabled:hover:border-gold/50"
                >
                  {r.pet?.name ?? r.query}
                  {r.points != null && <span className="text-text-muted"> · {r.points} {r.points === 1 ? 'pt' : 'pts'}</span>}
                </button>
              );
            })}
            {read.groups.map((g) => (
              <span key={g} className="rounded-full border border-card-border bg-brown-dark/40 px-3 py-1.5 text-xs">
                {PET_GROUPS.find((x) => x.key === g)?.label}
              </span>
            ))}
            {read.endsAll && <span className="rounded-full border border-gold/60 bg-gold/[0.08] px-3 py-1.5 text-xs text-gold-light">ends when one player has all of them</span>}
            {read.places != null && <span className="rounded-full border border-gold/60 bg-gold/[0.08] px-3 py-1.5 text-xs text-gold-light">top {read.places} win</span>}
            {read.rule && read.rule !== 'points' && <span className="rounded-full border border-card-border px-3 py-1.5 text-xs">{read.rule === 'first' ? 'first to get one' : 'most by the end'}</span>}
          </div>
        )}
        <p className="mt-1.5 text-xs text-text-muted">
          {typedNote || 'One line, the way you would say it in clan chat. A number after a name is its points. Each row then gets its own source and “Closest to it”, below.'}
        </p>
      </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/70" htmlFor="hunt-search">
          {rush ? 'Drops that score' : 'What are you hunting?'}
        </label>
        <div className="flex flex-wrap gap-2">
          <div ref={boxRef} className="relative min-w-0 flex-1 basis-72">
            <Input
              id="hunt-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={fullRows ? `That is the most a hunt can hold (${MAX_HUNT_ROWS})` : 'Search an item, a pet or a boss'}
              disabled={fullRows}
              autoComplete="off"
              aria-label="Search an item, a pet or a boss"
              className="min-h-11"
            />
            {open && query.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-card-border bg-card-bg shadow-xl">
                {!shown && <p className="px-3 py-2 text-xs text-text-muted">{searching ? 'Searching…' : 'Type at least two letters.'}</p>}
                {shown && shown.items.length === 0 && shown.bosses.length === 0 && !shown.pets?.length && (
                  <p className="px-3 py-2 text-xs text-text-muted">Nothing found. Try the full name.</p>
                )}
                {shown?.pets?.map((p) => (
                  <button
                    key={`p-${p.id}`}
                    type="button"
                    disabled={has(p.id)}
                    onClick={() => addPet(p)}
                    className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gold/10 disabled:opacity-40"
                  >
                    <ThingIcon src={itemIconUrl(p.id)} alt="" size={24} />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-light">Pet</span>
                  </button>
                ))}
                {shown?.bosses.map((b) => (
                  <div key={`b-${b.name}`} className="border-b border-card-border/60 px-3 py-2">
                    <p className="mb-1.5 text-[11px] uppercase tracking-widest text-text-muted">{b.name} drops</p>
                    <div className="flex flex-wrap gap-1.5">
                      {b.items.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          disabled={has(it.id) || fullItems}
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
                    disabled={has(it.id) || fullItems}
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
          <div className="w-full sm:w-56">
            <Select
              value=""
              onChange={(v) => v && addGroup(v)}
              ariaLabel="Add a pet group"
              placeholder="Add a pet group"
              disabled={fullRows}
              options={PET_GROUPS.map((g) => ({ value: g.key, label: `${g.label} (${g.items.length})` }))}
            />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          {rush
            ? 'Each boss you pick fills this with its collection log uniques. Give each drop its points, remove what should not score, or search to add more. A drop left at 0 is listed and scores nothing.'
            : <>Items and pets go in one list. &ldquo;Add a pet group&rdquo; drops in every pet of a group as rows you can then trim. Up to {MAX_HUNT_ITEMS} items; pets do not count toward that.</>}
        </p>
        {rush && unpriced > 0 && <p className="mt-1.5 text-xs text-amber-300">{unpriced} {unpriced === 1 ? 'drop has' : 'drops have'} no points yet.</p>}

        {value.items.length > 0 && (
          <ul className="mt-3 space-y-2.5">
            {value.items.map((it) => {
              const extra = it.sources.filter((s) => !it.known.some((k) => k.toLowerCase() === s.toLowerCase()));
              const unchosen = !it.pet && !it.anySource && it.sources.length === 0;
              const rate = rateWords(it, rates[it.id]);
              return (
                <li id={`hunt-row-${it.id}`} key={it.id} className={`rounded-lg border p-3 ${unchosen ? 'border-amber-400/60 bg-amber-400/[0.04]' : 'border-card-border bg-brown-dark/30'}`}>
                  <div className="flex items-center gap-2.5">
                    <ThingIcon src={itemIconUrl(it.id)} alt="" size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.name}</span>
                    <span className="rounded bg-card-border/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">{it.pet ? 'Pet' : 'Item'}</span>
                    <button
                      type="button"
                      onClick={() => set({ items: value.items.filter((x) => x.id !== it.id) })}
                      className="min-h-11 min-w-11 rounded px-2 text-xs text-text-muted hover:text-red-400"
                      aria-label={`Remove ${it.name}`}
                    >
                      Remove
                    </button>
                  </div>

                  {!it.pet && (
                    <>
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
                        <Checkbox checked={it.anySource} onChange={(on) => setItem(it.id, { anySource: on })} label="Any source" description="Counts wherever it drops." className="text-sm" />
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
                    </>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    {(value.rule === 'points' || rush) && (
                      <label className="flex items-center gap-2">
                        <span className="text-foreground/70">Worth</span>
                        <NumberInput value={it.points} onChange={(v) => setItem(it.id, { points: v })} min={rush ? 0 : 1} max={MAX_ITEM_POINTS} fallback={rush ? 0 : 1} className="w-20" aria-label={`Points for ${it.name}`} />
                        <span className="text-text-muted">{it.count === 'quantity' ? 'pts each' : it.points === 1 ? 'pt' : 'pts'}</span>
                      </label>
                    )}
                    {rush && <Checkbox checked={!!it.once} onChange={(on) => setItem(it.id, { once: on })} label="Counts once" className="text-sm" />}
                    {rush && it.rate != null && <span className="text-xs text-text-muted">{rarityWords(it.rate)}</span>}
                    {!it.pet && !rush && (
                      <div className="w-full max-w-xs sm:w-60">
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
                    )}
                    {!rush && (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <span className="text-foreground/70">Closest to it</span>
                      <div className="w-full sm:w-64">
                        <Select value={it.stat} onChange={(v) => setItem(it.id, { stat: v, statAuto: false })} ariaLabel={`Closest to ${it.name}`} options={statOptions(it.stat)} searchable />
                      </div>
                      {rate && <span className="text-xs text-text-muted">{rate}</span>}
                    </div>
                    )}
                  </div>
                  {!rush && <BountyField name={it.name} value={it.bounty} onChange={(bounty) => setItem(it.id, { bounty })} />}
                </li>
              );
            })}
          </ul>
        )}
        {value.items.length > 0 && !rush && (
          <p className="mt-2 text-xs text-text-muted">
            &ldquo;Closest to it&rdquo; is picked for you: a boss pet takes its boss&rsquo;s kills, a skilling pet its skill&rsquo;s XP, an item the kills at its source. Change it, or
            choose &ldquo;Nothing&rdquo; to leave that row out of the progress line. Players without a drop are ordered by how much of the drop rates they have worked through.
          </p>
        )}
      </div>

      {(value.rule === 'points' || rush) && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground/70">A second drop of the same item</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ['every', 'Scores again', 'Three of an item worth 2 is 6 points.'],
              ['first', "Only each player's first one scores", 'Three of an item worth 2 is 2 points: rewards getting a spread.'],
            ] as const).map(([key, label, blurb]) => (
              <label key={key} className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${value.repeat === key ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
                <Radio name="hunt-repeat" checked={value.repeat === key} onChange={() => set({ repeat: key })} />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-text-muted">{blurb}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-text-muted">An item counted by quantity scores its points for each piece in the stack; one counted by drop scores once per drop. &ldquo;End after N drops&rdquo; still counts drops.</p>
        </div>
      )}

      <HuntEndingFields ends={value.ends} confirm={value.confirm} onChange={(patch) => set(patch)} rowCount={rowCount} dateOnly={rush} />

      {prizes && <HuntPrizesField places={value.prizes} onChange={(next) => set({ prizes: next })} />}

      <p className="text-xs text-text-muted">
        {rush && (value.rush.kcSource === 'plugin' ? 'Only kills the Anvil plugin sees count, so players need it running. ' : 'Kills count from the plugin and the hiscores, so players without the plugin can take part. ')}
        Drops count from the Anvil plugin, or from a screenshot with the kill count or XP that staff approve. Everyone on the roster is entered when it starts; there is no board, no teams and no
        sign-up.
      </p>
    </div>
  );
}

/**
 * "Top 3 win" and what each place gets: the competition's own prize ladder (lib/weeklyPrizes), set
 * while creating it. Only a treasurer or admin can set prizes, and the server says so if not.
 */
function HuntPrizesField({ places, onChange }: { places: number[]; onChange: (next: number[]) => void }) {
  const count = places.length;
  return (
    <div className="rounded-lg border border-card-border bg-brown-dark/30 p-3">
      <p className="mb-2 text-sm font-medium text-foreground/70">Prizes</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Top</span>
        <NumberInput
          value={count}
          onChange={(n) => onChange(Array.from({ length: Math.max(0, Math.min(MAX_WEEKLY_PLACES, n)) }, (_, i) => places[i] ?? 0))}
          min={0}
          max={MAX_WEEKLY_PLACES}
          fallback={0}
          className="w-16"
          aria-label="Places paid"
        />
        <span>win</span>
      </div>
      {count > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {places.map((gp, i) => (
            <label key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-8 font-semibold text-gold">{ORDINALS[i] ?? `${i + 1}th`}</span>
              <Input
                type="text"
                inputMode="numeric"
                value={gp ? String(gp) : ''}
                onChange={(e) => onChange(places.map((p, j) => (j === i ? (parseGpInput(e.target.value) ?? 0) : p)))}
                placeholder="e.g. 10m"
                className="min-h-11 w-28"
                aria-label={`Prize for ${ORDINALS[i] ?? `${i + 1}th`} place`}
              />
              {gp > 0 && <span>{formatGp(gp)}</span>}
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-text-muted">
        {count > 0 && places.some((gp) => !(gp > 0))
          ? 'Give every place an amount, or lower the number of places.'
          : 'The same prize ladder every competition has, set from here; change it later on the competition’s page. Places nobody reaches are not paid. Only a treasurer or admin can set prizes.'}
      </p>
    </div>
  );
}

/** A gp amount typed the way people say it ("20m", "1.5b"): kept as typed until it reads as one. */
function GpInput({ gp, onChange, className, label }: { gp: number; onChange: (gp: number) => void; className: string; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft ?? formatGp(gp)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseGpInput(e.target.value);
        if (n != null && n >= 1) onChange(n);
      }}
      onBlur={() => setDraft(null)}
      placeholder="e.g. 20m"
      className={`min-h-11 ${className}`}
      aria-label={label}
    />
  );
}

/**
 * One row's bounty: what the first N players to get it are paid, each one claim per player. The
 * first amount, how many it pays and the taper fill the list; any place can then be changed by hand.
 * What is saved is the list, not the formula. Paid in the competition's prize currency, through the
 * same settle as the place prizes; only a treasurer or admin can set one, and the server says so.
 */
function BountyField({ name, value, onChange }: { name: string; value: number[]; onChange: (next: number[]) => void }) {
  const [taper, setTaper] = useState<'less' | 'same'>(value.length > 1 && value.every((v) => v === value[0]) ? 'same' : 'less');
  const [pct, setPct] = useState(DEFAULT_BOUNTY_TAPER);
  if (value.length === 0) {
    return (
      <button type="button" onClick={() => onChange([1_000_000])} className="mt-2 min-h-11 rounded px-1 text-xs text-gold-light hover:underline">
        + Add a bounty
      </button>
    );
  }
  const fill = (first: number, n: number, mode = taper, by = pct) => onChange(taperBounty(first, n, mode === 'same' ? null : by));
  return (
    <div className="mt-2.5 rounded-md border border-card-border/70 bg-brown-dark/40 p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium text-foreground/80">Bounty</span>
        <GpInput gp={value[0]} onChange={(gp) => fill(gp, value.length)} className="w-28" label={`Bounty for the first to get ${name}`} />
        <span className="flex items-center gap-1.5">
          <span className="text-foreground/70">Pays the first</span>
          <NumberInput value={value.length} onChange={(n) => fill(value[0], n)} min={1} max={MAX_BOUNTY_PLACES} fallback={1} className="w-16" aria-label={`How many players the ${name} bounty pays`} />
        </span>
        {value.length > 1 && (
          <div className="w-full sm:w-56">
            <Select
              value={taper}
              onChange={(v) => {
                const mode = v === 'same' ? 'same' : 'less';
                setTaper(mode);
                fill(value[0], value.length, mode);
              }}
              ariaLabel={`How the ${name} bounty tapers`}
              options={[
                { value: 'less', label: 'Each next place gets less' },
                { value: 'same', label: 'Same for all' },
              ]}
            />
          </div>
        )}
        {value.length > 1 && taper === 'less' && (
          <span className="flex items-center gap-1.5">
            <NumberInput
              value={pct}
              onChange={(v) => {
                setPct(v);
                fill(value[0], value.length, 'less', v);
              }}
              min={1}
              max={99}
              fallback={DEFAULT_BOUNTY_TAPER}
              className="w-16"
              aria-label={`How much less each next place of the ${name} bounty gets`}
            />
            <span className="text-text-muted">% less</span>
          </span>
        )}
        <button type="button" onClick={() => onChange([])} className="min-h-11 rounded px-1 text-xs text-text-muted hover:text-red-400">
          Remove bounty
        </button>
      </div>
      {value.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((gp, i) => (
            <label key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-8 font-semibold text-gold">{ORDINALS[i] ?? `${i + 1}th`}</span>
              <GpInput gp={gp} onChange={(next) => onChange(value.map((p, j) => (j === i ? next : p)))} className="w-24" label={`${name} bounty for the ${ORDINALS[i] ?? `${i + 1}th`} player`} />
            </label>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-text-muted">
        {value.length === 1 ? `The first player whose ${name} counts gets ${formatGp(value[0])}.` : `The first ${value.length} players whose ${name} counts are paid in that order, once each.`} A held or
        waiting drop claims once staff approve it. Paid with the prizes when the hunt ends.
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
  rowCount,
  dateOnly = false,
}: {
  ends: HuntEnding;
  confirm: HuntConfirm;
  onChange: (patch: { ends?: HuntEnding; confirm?: HuntConfirm }) => void;
  /** Radio group prefix, for a page that shows this more than once. */
  name?: string;
  /** How many rows the hunt has, for "the first to hold all 3". */
  rowCount?: number;
  /** Boss Rush: it always runs to its end date, so only who confirms drops is a choice. */
  dateOnly?: boolean;
}) {
  const n = ends.kind === 'drops' ? ends.n : 1;
  return (
    <div className="space-y-4">
      {dateOnly ? (
        <p className="text-xs text-text-muted">A Boss Rush runs to its end date. Staff can also end it by hand from its page.</p>
      ) : (
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">How it ends</p>
        <div className="space-y-2">
          <label className={`flex cursor-pointer gap-2.5 text-sm rounded-lg border p-3 ${ends.kind === 'date' ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
            <Radio name={`${name}-ends`} checked={ends.kind === 'date'} onChange={() => onChange({ ends: { kind: 'date' } })} />
            <span>
              <span className="block text-sm font-medium">At the end date</span>
              <span className="block text-xs text-text-muted">It runs the whole time and lists everyone who got one, in order.</span>
            </span>
          </label>
          <div className={`rounded-lg border p-3 ${ends.kind === 'drops' ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
            <label className="flex cursor-pointer gap-2.5 text-sm">
              <Radio name={`${name}-ends`} checked={ends.kind === 'drops'} onChange={() => onChange({ ends: { kind: 'drops', n, by: 'all' } })} />
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
          <label className={`flex cursor-pointer gap-2.5 text-sm rounded-lg border p-3 ${ends.kind === 'all' ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
            <Radio name={`${name}-ends`} checked={ends.kind === 'all'} onChange={() => onChange({ ends: { kind: 'all' } })} />
            <span>
              <span className="block text-sm font-medium">When a player has all of them</span>
              <span className="block text-xs text-text-muted">
                The first to hold {rowCount && rowCount > 1 ? `all ${rowCount}` : 'every one'} wins; the rest rank by the rule. It ends at the end date if nobody does.
              </span>
            </span>
          </label>
          <p className="text-xs text-text-muted">Staff can also end it by hand at any time, from the hunt&rsquo;s page: End now and post results.</p>
        </div>
      </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">Who confirms drops</p>
        <div className="space-y-2">
          <label className={`flex cursor-pointer gap-2.5 text-sm rounded-lg border p-3 ${confirm === 'staff' ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
            <Radio name={`${name}-confirm`} checked={confirm === 'staff'} onChange={() => onChange({ confirm: 'staff' })} />
            <span>
              <span className="block text-sm font-medium">Staff confirm each drop that decides the result</span>
              <span className="block text-xs text-text-muted">
                Drops show in the standings as they arrive. An early ending, and any prizes, wait until staff have confirmed the drops they rest on.
              </span>
            </span>
          </label>
          <label className={`flex cursor-pointer gap-2.5 text-sm rounded-lg border p-3 ${confirm === 'auto' ? 'border-amber-400/60 bg-amber-400/[0.05]' : 'border-card-border bg-brown-dark/30'}`}>
            <Radio name={`${name}-confirm`} checked={confirm === 'auto'} onChange={() => onChange({ confirm: 'auto' })} />
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

/** "All raids": every raid and its harder mode, as the game names them. Entry Modes are picked one by one. */
const ALL_RAIDS = RUSH_RAID_TARGETS.filter((r) => !/entry mode/i.test(r.name)).map((r) => r.name);

/** What the picker offers before anything is typed: every raid mode, then every boss the hiscores keep. */
const RAID_KEYS = new Set(['chambersOfXeric', 'chambersOfXericChallengeMode', 'theatreOfBlood', 'theatreOfBloodHardMode', 'tombsOfAmascut', 'tombsOfAmascutExpertMode']);
const LOCAL_TARGETS: { name: string; hint: string; keywords: string[] }[] = [
  ...RUSH_RAID_TARGETS.map((r) => ({ name: r.name, hint: 'Raid', keywords: ['raids', r.raid] })),
  ...BOSSES.filter((b) => !RAID_KEYS.has(b.key)).map((b) => ({ name: b.label, hint: 'Boss', keywords: b.aliases ?? [] })),
];

/**
 * Pick any number of targets without the list closing: bosses and raid modes straight away, any
 * other monster by name as you type (the wiki's list, api/admin/npc-search). A click ticks or unticks.
 */
function TargetPicker({ picked, onAdd, onRemove, full }: { picked: string[]; onAdd: (names: string[]) => void; onRemove: (name: string) => void; full: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const on = new Set(picked.map((p) => p.toLowerCase()));

  useEffect(() => {
    function away(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await clanFetch(`/api/admin/npc-search?q=${encodeURIComponent(query)}`);
        const rows = res.ok ? ((await res.json()) as { name: string }[]) : [];
        if (!cancelled) setFound(rows.map((r) => r.name));
      } catch {
        if (!cancelled) setFound([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const query = q.trim().toLowerCase();
  const local = LOCAL_TARGETS.filter((o) => !query || o.name.toLowerCase().includes(query) || o.keywords.some((k) => k.toLowerCase().includes(query)));
  const localNames = new Set(local.map((o) => o.name.toLowerCase()));
  const options = [
    ...local.map((o) => ({ name: o.name, hint: o.hint })),
    ...(query.length >= 2 ? found.filter((n) => !localNames.has(n.toLowerCase())).map((n) => ({ name: n, hint: 'Monster' })) : []),
  ].slice(0, 80);

  return (
    <div ref={box} className="relative">
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={full ? `That is the most a rush can hold (${MAX_RUSH_TARGETS})` : 'Search a boss, raid mode or monster'}
        aria-label="Search a boss, raid mode or monster"
        autoComplete="off"
        className="min-h-11"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-card-border bg-card-bg shadow-xl" role="listbox" aria-multiselectable>
          {options.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">{query.length >= 2 ? 'Nothing found. Try the name as the game writes it.' : 'Type to find a monster.'}</p>}
          {options.map((o) => {
            const ticked = on.has(o.name.toLowerCase());
            return (
              <button
                key={o.name}
                type="button"
                role="option"
                aria-selected={ticked}
                disabled={!ticked && full}
                // The list stays open: pick as many as you like.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (ticked ? onRemove(picked.find((p) => p.toLowerCase() === o.name.toLowerCase()) ?? o.name) : onAdd([o.name]))}
                className={`flex min-h-10 w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-gold/10 disabled:opacity-40 ${ticked ? 'bg-gold/[0.06]' : ''}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${ticked ? 'border-gold bg-gold text-brown-dark' : 'border-card-border'}`}>{ticked ? '✓' : ''}</span>
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-text-muted">{o.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Boss Rush's own settings: the targets (each fills the drop list below with its notable drops),
 * what a kill and a death are worth, whose kills count, Clan Synergy, and whether a score can go
 * below 0. All but the targets can change while it runs (lib/itemHuntDb updateHuntSettings).
 */
export function RushFields({
  targets,
  rules,
  onAdd,
  onRemove,
  onRules,
  note = '',
  lockTargets = false,
}: {
  targets: string[];
  rules: RushRules;
  onAdd?: (names: string[]) => void;
  onRemove?: (name: string) => void;
  onRules: (patch: Partial<RushRules>) => void;
  note?: string;
  /** Running: the targets are fixed, their starting counts are already read. */
  lockTargets?: boolean;
}) {
  const s = rules.synergy;
  const setSynergy = (patch: Partial<RushRules['synergy']>) => onRules({ synergy: { ...s, ...patch } });
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">What counts</p>
        {targets.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <span key={t} className="flex min-h-9 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/[0.06] pl-3 pr-1 text-xs">
                {t}
                {!lockTargets && onRemove && (
                  <button type="button" onClick={() => onRemove(t)} className="min-h-9 min-w-9 rounded-full text-text-muted hover:text-red-400" aria-label={`Remove ${t}`}>
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {!lockTargets && onAdd && onRemove && (
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1 basis-72">
              <TargetPicker picked={targets} onAdd={onAdd} onRemove={onRemove} full={targets.length >= MAX_RUSH_TARGETS} />
            </div>
            {ALL_RAIDS.some((r) => !targets.some((t) => t.toLowerCase() === r.toLowerCase())) && (
              <button type="button" onClick={() => onAdd(ALL_RAIDS)} className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm font-semibold text-gold hover:bg-gold/10">
                All raids
              </button>
            )}
          </div>
        )}
        {note && <p className="mt-1.5 text-xs text-amber-300">{note}</p>}
        <p className="mt-1.5 text-xs text-text-muted">
          {lockTargets
            ? 'What counts is set once it has started.'
            : `Up to ${MAX_RUSH_TARGETS}: bosses, each raid mode (Entry Mode included, picked on its own) or any monster, hiscores or not. "All raids" adds every raid and its harder mode.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/70">Each kill</span>
          <NumberInput value={rules.kcPoints} onChange={(v) => onRules({ kcPoints: v })} min={0} max={MAX_RUSH_POINTS} fallback={1} className="w-20" aria-label="Points per kill" />
          <span className="text-text-muted">{rules.kcPoints === 1 ? 'pt' : 'pts'}</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Checkbox checked={rules.deaths} onChange={(on) => onRules({ deaths: on })} label="Deaths cost points" className="text-sm" />
          {rules.deaths && (
            <span className="flex items-center gap-2">
              <span className="text-text-muted">-</span>
              <NumberInput value={rules.deathPoints} onChange={(v) => onRules({ deathPoints: v })} min={0} max={MAX_RUSH_POINTS} fallback={1} className="w-20" aria-label="Points per death" />
              <span className="text-text-muted">each</span>
            </span>
          )}
        </div>
      </div>
      {rules.deaths && <p className="-mt-2 text-xs text-text-muted">A death counts when the plugin names a target as the killer, or it happened inside a raid that counts (puzzle and mechanic deaths included).</p>}

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground/70">Whose kills count</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['plugin', 'Only kills the plugin sees', 'Kills done with the plugin off, or on another client, do not count. Turning it off to hide deaths hides the kills too.'],
            ['any', 'Every kill', 'Kills on the hiscores count too, so players without the plugin can take part. Their deaths are not seen.'],
          ] as const).map(([key, title, blurb]) => (
            <label key={key} className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${rules.kcSource === key ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
              <Radio name="rush-kc-source" checked={rules.kcSource === key} onChange={() => onRules({ kcSource: key })} />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-text-muted">{blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Checkbox
          checked={s.on}
          onChange={(v) => setSynergy({ on: v })}
          label="Clan Synergy"
          description="A kill at a raid or group boss done together with other entrants is worth more."
          className="text-sm"
        />
        {s.on && (
          <div className="mt-2 space-y-2 pl-6 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['flat', 'A bonus for doing it together', 'The same bonus however many of you there were.'],
                ['perMate', 'A bonus per clanmate', 'More clanmates with you, more points, up to a cap.'],
              ] as const).map(([key, title, blurb]) => (
                <label key={key} className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 ${s.mode === key ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-brown-dark/30'}`}>
                  <Radio name="rush-synergy-mode" checked={s.mode === key} onChange={() => setSynergy({ mode: key })} />
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-text-muted">{blurb}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-2">
                <span className="text-foreground/70">+</span>
                <NumberInput value={s.points} onChange={(v) => setSynergy({ points: v })} min={0} max={MAX_SYNERGY} fallback={1} className="w-20" aria-label="Clan Synergy points" />
                <span className="text-text-muted">{s.mode === 'flat' ? 'a kill done together' : 'per clanmate with you'}</span>
              </span>
              {s.mode === 'perMate' && (
                <span className="flex items-center gap-2">
                  <span className="text-foreground/70">up to</span>
                  <NumberInput value={s.max} onChange={(v) => setSynergy({ max: v })} min={0} max={MAX_SYNERGY} fallback={3} className="w-20" aria-label="Most per kill" />
                  <span className="text-text-muted">a kill</span>
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Counts at the raids (Entry Mode included) and group bosses (God Wars, Nex, the Nightmare, Corp, the Dagannoth Kings, the Royal Titans, the Hueycoatl, Yama and the like), never at a
              boss fought alone such as Phosani&rsquo;s Nightmare. Everyone in the group needs the plugin running: kills that land together are how it knows.
            </p>
          </div>
        )}
      </div>

      <Checkbox checked={rules.floorZero} onChange={(on) => onRules({ floorZero: on })} label="A score never goes below 0" className="text-sm" />
    </div>
  );
}
