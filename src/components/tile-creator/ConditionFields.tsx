'use client';

// The pieces a tile's conditions are edited with (lib/tileConditions): a raid card per raid, the
// "every raid" rules, the ToA level control, the clock and the "who can take it" start count. The
// raid step's typed box, its "pick from a list" grid, the confirm step, the items step and the full
// editor all use these, so a condition looks and reads the same wherever it is set.

import { useId, useState, type ReactNode } from 'react';
import Select from '@/components/Select';
import ActionMenu from '@/components/ActionMenu';
import {
  RAID_PARTY_MAX,
  challengeSeconds,
  clockWords,
  raidOffers,
  type PartyBar,
  type RaidId,
  type RaidModeId,
  type RaidPick,
  type StartCount,
  type TileConditions,
  type ToaBar,
} from '@/lib/tileConditions';
import { RAID_OPTIONS } from '@/lib/tileCreatorConfig';
import { DEFAULT_TOA, RAID_NAME, defaultModes, newPick } from '@/lib/raidQuery';

// ─── Small inputs ────────────────────────────────────────────────────────────────────────────

/** A whole number field sized for a sentence. Blank reads as null. */
export function NumberInput({
  value,
  onChange,
  label,
  max,
  min = 0,
  className = 'w-16',
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  label: string;
  max?: number;
  min?: number;
  className?: string;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        if (!raw) return onChange(null);
        const n = parseInt(raw, 10);
        onChange(max != null ? Math.min(max, Math.max(min, n)) : Math.max(min, n));
      }}
      className={`${className} min-h-9 px-2 rounded-md bg-brown-dark border border-card-border text-center text-sm font-semibold text-foreground focus:outline-none focus:border-gold`}
    />
  );
}

export function clockSecondsOf(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const parts = t.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 1) return parts[0] > 0 ? parts[0] * 60 : null;
  if (parts.length === 2) return parts[0] * 60 + parts[1] || null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2] || null;
  return null;
}

/** "mm:ss" (or h:mm:ss, or plain minutes). Keeps what is typed until it reads as a time. */
export function ClockInput({ seconds, onChange, label }: { seconds: number | null | undefined; onChange: (s: number | null) => void; label: string }) {
  const [text, setText] = useState(seconds ? clockWords(seconds) : '');
  const [last, setLast] = useState(seconds);
  // A change from outside (a pill removed, the box re-read) resets what the field shows.
  if (seconds !== last) {
    setLast(seconds);
    if (clockSecondsOf(text) !== seconds) setText(seconds ? clockWords(seconds) : '');
  }
  return (
    <input
      aria-label={label}
      placeholder="mm:ss"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const s = clockSecondsOf(e.target.value);
        if (s != null) {
          setLast(s);
          onChange(s);
        }
      }}
      className="w-20 min-h-9 px-2 rounded-md bg-brown-dark border border-card-border text-center text-sm text-foreground focus:outline-none focus:border-gold"
    />
  );
}

/** A compact toggle chip (36px; the mock's mode buttons). */
export function Chip({ pressed, onClick, children, label }: { pressed: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`min-h-9 px-2.5 rounded-md border text-[13px] transition-colors ${
        pressed ? 'border-gold bg-gold/15 text-gold font-semibold' : 'border-card-border text-foreground/80 hover:border-gold/50'
      }`}
    >
      {children}
    </button>
  );
}

/** A dashed "+ add" chip. */
export function AddChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 px-2.5 rounded-full border border-dashed border-card-border text-xs text-foreground/80 hover:border-gold/50 hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** One set condition as a row: what it is, its own control, and × to drop it. */
export function ConditionRow({ children, onRemove, removeLabel }: { children: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-card-border pl-2 text-xs">
      {children}
      <span className="flex-1" />
      <button type="button" aria-label={removeLabel} onClick={onRemove} className="w-9 h-9 grid place-items-center text-text-muted hover:text-foreground">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}

// ─── Party, level, start count ───────────────────────────────────────────────────────────────

const PARTY_OPS = [
  { value: 'eq', label: 'exactly' },
  { value: 'gte', label: 'at least' },
  { value: 'lte', label: 'at most' },
];

export function PartyField({ raid, bar, onChange }: { raid: RaidId; bar: PartyBar; onChange: (b: PartyBar) => void }) {
  const max = RAID_PARTY_MAX[raid];
  return (
    <>
      <span>Party</span>
      <Select value={bar.op} onChange={(v) => onChange({ ...bar, op: v as PartyBar['op'] })} options={PARTY_OPS} ariaLabel={`${RAID_NAME[raid]} party: exactly, at least or at most`} className="w-28" />
      <NumberInput value={bar.n} onChange={(n) => onChange({ ...bar, n: n ?? 1 })} label={`${RAID_NAME[raid]} party size`} min={1} max={max} className="w-12" />
      <span className="text-text-muted">{bar.op === 'eq' && bar.n === 1 ? '(solo)' : `of up to ${max}`}</span>
    </>
  );
}

const LEVEL_OPS = [
  { value: 'gte', label: 'or higher' },
  { value: 'eq', label: 'exactly' },
  { value: 'lte', label: 'or lower' },
];

/**
 * A ToA level bar: Entry, 150+, 300+ or "…" for any level with exactly / or higher / or lower.
 * `allowAny` adds "Any" (a drop tile's level is optional).
 */
export function ToaLevelField({
  bar,
  onChange,
  allowAny = false,
  label = 'ToA raid level',
}: {
  bar: ToaBar | null;
  onChange: (b: ToaBar | null) => void;
  allowAny?: boolean;
  label?: string;
}) {
  const op = bar?.op ?? 'gte';
  const preset = bar && op === 'gte' && (bar.min === 150 || bar.min === 300) ? bar.min : null;
  const [customPicked, setCustom] = useState(false);
  // A level typed elsewhere (the box, a saved tile) that isn't a preset opens the custom control.
  const custom = customPicked || (!!bar && preset == null);
  const set = (min: number, nextOp: ToaBar['op'] = 'gte') => {
    const next: ToaBar = { min, entry: bar?.entry ?? false };
    if (nextOp && nextOp !== 'gte') next.op = nextOp;
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {allowAny && (
          <Chip pressed={!bar} onClick={() => { setCustom(false); onChange(null); }}>
            Any
          </Chip>
        )}
        <Chip pressed={!!bar?.entry} onClick={() => onChange({ ...(bar ?? DEFAULT_TOA), entry: !bar?.entry })} label="Entry Mode counts too">
          Entry
        </Chip>
        <Chip pressed={!custom && preset === 150} onClick={() => { setCustom(false); set(150); }}>150+</Chip>
        <Chip pressed={!custom && preset === 300} onClick={() => { setCustom(false); set(300); }}>300+</Chip>
        <Chip pressed={custom} onClick={() => { setCustom(true); if (!bar || preset != null) set(bar?.min && bar.min !== 150 ? bar.min : 400, bar?.op); }} label="Another level">
          …
        </Chip>
      </div>
      {custom && bar && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span>Level</span>
          <NumberInput value={bar.min} onChange={(n) => set(n ?? 150, op)} label="ToA raid level" min={0} max={600} />
          <Select value={op} onChange={(v) => set(bar.min, v as ToaBar['op'])} options={LEVEL_OPS} ariaLabel="Exactly, or higher, or lower" className="w-28" />
        </div>
      )}
      {bar && bar.min < 150 && <p className="text-xs text-amber-200">Below 150 is Entry Mode: tick Entry instead.</p>}
    </div>
  );
}

/** "Who can take it": anyone, or only players under / over a count when the event starts. */
export function StartCountField({
  value,
  onChange,
  noun = 'kills',
}: {
  value: StartCount | null | undefined;
  onChange: (v: StartCount | null) => void;
  noun?: string;
}) {
  const id = useId();
  const mode = value ? value.op : 'any';
  const pick = (m: 'any' | 'lt' | 'gt') =>
    onChange(m === 'any' ? null : { op: m, n: value?.op === m ? value.n : m === 'lt' ? 1 : 50 });
  return (
    <div role="group" aria-labelledby={`${id}-h`} className="rounded-xl border border-card-border bg-brown-dark/40 p-3">
      <p id={`${id}-h`} className="text-sm font-semibold mb-2">Who can take it</p>
      <div role="radiogroup" aria-label="Count when the event starts" className="grid grid-cols-3 gap-1.5">
        {(['any', 'lt', 'gt'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => pick(m)}
            className={`min-h-11 px-2 rounded-lg border text-sm transition-colors ${
              mode === m ? 'bg-gold/15 border-gold text-gold' : 'border-card-border text-foreground hover:border-gold/50'
            }`}
          >
            {m === 'any' ? 'Anyone' : m === 'lt' ? 'Under a count' : 'Over a count'}
          </button>
        ))}
      </div>
      {value && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{value.op === 'lt' ? 'Fewer than' : 'More than'}</span>
          <NumberInput value={value.n} onChange={(n) => onChange({ ...value, n: n ?? (value.op === 'lt' ? 1 : 0) })} label={`${noun} when the event starts`} min={value.op === 'lt' ? 1 : 0} />
          <span>{noun} when the event starts</span>
          {value.op === 'lt' && <span className="text-xs text-text-muted">(1 = first-timers)</span>}
        </div>
      )}
    </div>
  );
}

// ─── Raid cards ──────────────────────────────────────────────────────────────────────────────

type Offer = 'under' | 'challenge' | 'party' | 'scale';

/** What a raid card's "+ Condition" can add: only what that raid (and its modes) can do, not set yet. */
function offersFor(p: RaidPick): { key: Offer; label: string }[] {
  const o = raidOffers(p.raid, p.modes ?? []);
  const out: { key: Offer; label: string }[] = [];
  if (p.under == null) out.push({ key: 'under', label: 'Under a time' });
  if (o.challenge && !p.challenge) out.push({ key: 'challenge', label: 'Beat the challenge time' });
  if (!p.party) out.push({ key: 'party', label: 'Party size' });
  if (o.scale && p.scale == null) out.push({ key: 'scale', label: 'Scaled to' });
  return out;
}

function addOffer(p: RaidPick, key: Offer): RaidPick {
  if (key === 'under') return { ...p, under: 30 * 60 };
  if (key === 'challenge') return { ...p, challenge: true };
  if (key === 'party') return { ...p, party: { op: 'eq', n: 1 } };
  return { ...p, scale: 10 };
}

/** The challenge time a pick's party / scale points at, in words, when it has one. */
function challengeNote(p: RaidPick): string | null {
  const mode: RaidModeId = p.raid === 'cox' ? 'cm' : 'hard';
  const size = p.raid === 'cox' ? p.scale ?? (p.party?.op === 'eq' ? p.party.n : null) : p.party?.op === 'eq' ? p.party.n : null;
  if (size == null) return 'the game’s time for the party size';
  const s = challengeSeconds(p.raid, mode, size);
  return s ? `${clockWords(s)} for ${size}` : null;
}

/** One raid's card: its modes (or ToA level), each bar it carries, and "+ Condition". */
export function RaidCard({
  raid,
  pick,
  onChange,
}: {
  raid: RaidId;
  /** null = this raid isn't on the tile yet; any mode pressed adds it. */
  pick: RaidPick | null;
  onChange: (p: RaidPick | null) => void;
}) {
  const opt = RAID_OPTIONS.find((r) => r.id === raid)!;
  const p = pick;
  const toggleMode = (m: RaidModeId) => {
    if (!p) return onChange({ raid, modes: [m] });
    const has = (p.modes ?? []).includes(m);
    const modes = has ? (p.modes ?? []).filter((x) => x !== m) : [...(p.modes ?? []), m];
    if (modes.length === 0) return onChange(null);
    const next: RaidPick = { ...p, modes: opt.modes.map((x) => x.id).filter((x) => modes.includes(x)) };
    // The challenge time goes with its mode.
    if (next.challenge && !raidOffers(raid, next.modes ?? []).challenge) delete next.challenge;
    onChange(next);
  };
  const offers = p ? offersFor(p) : [];
  return (
    <div className={`rounded-xl border p-2.5 flex flex-col gap-2 min-w-0 ${p ? 'border-gold/50 bg-gold/[0.04]' : 'border-card-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${p ? '' : 'text-foreground/70'}`}>
          {RAID_NAME[raid]} {raid === 'toa' && <span className="font-normal text-text-muted">raid level</span>}
        </span>
        {p && (
          <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${opt.label}`} className="w-9 h-9 -m-1 grid place-items-center text-text-muted hover:text-foreground">
            <span aria-hidden="true">&times;</span>
          </button>
        )}
      </div>
      {raid === 'toa' ? (
        <ToaLevelField bar={p?.toa ?? null} onChange={(b) => onChange(b ? { ...(p ?? { raid }), toa: b } : null)} allowAny={false} />
      ) : (
        <div role="group" aria-label={`${opt.label} modes`} className="flex flex-wrap gap-1.5">
          {opt.modes.map((m) => (
            <Chip key={m.id} pressed={!!p?.modes?.includes(m.id)} onClick={() => toggleMode(m.id)}>
              {m.id === 'cm' ? 'CM' : m.id === 'hard' ? 'HM' : m.label}
            </Chip>
          ))}
        </div>
      )}
      {p && <PickBars pick={p} onChange={onChange} />}
      {p && offers.length > 0 && (
        <div>
          <ActionMenu
            label="+ Condition"
            align="left"
            items={offers.map((o) => ({ label: o.label, onClick: () => onChange(addOffer(p, o.key)) }))}
          />
        </div>
      )}
    </div>
  );
}

/** The bars a pick carries, each with its control and ×. */
export function PickBars({ pick: p, onChange }: { pick: RaidPick; onChange: (p: RaidPick) => void }) {
  const name = RAID_NAME[p.raid];
  const drop = (k: keyof RaidPick) => {
    const next = { ...p };
    delete next[k];
    onChange(next);
  };
  return (
    <>
      {p.party && (
        <ConditionRow onRemove={() => drop('party')} removeLabel={`Remove ${name} party size`}>
          <PartyField raid={p.raid} bar={p.party} onChange={(b) => onChange({ ...p, party: b })} />
        </ConditionRow>
      )}
      {p.scale != null && p.raid === 'cox' && (
        <ConditionRow onRemove={() => drop('scale')} removeLabel="Remove the scale">
          <span>Scaled to</span>
          <NumberInput value={p.scale} onChange={(n) => onChange({ ...p, scale: n ?? 1 })} label="CoX scaled to" min={1} max={RAID_PARTY_MAX.cox} className="w-12" />
          <span className="text-text-muted">or more</span>
        </ConditionRow>
      )}
      {p.under != null && (
        <ConditionRow onRemove={() => drop('under')} removeLabel={`Remove ${name} time`}>
          <span>Under</span>
          <ClockInput seconds={p.under} onChange={(s) => onChange({ ...p, under: s ?? p.under })} label={`${name} time`} />
        </ConditionRow>
      )}
      {p.challenge && (
        <ConditionRow onRemove={() => drop('challenge')} removeLabel={`Remove ${name} challenge time`}>
          <span className="min-h-9 inline-flex items-center">Beat the challenge time</span>
          <span className="text-text-muted">{challengeNote(p)}</span>
        </ConditionRow>
      )}
    </>
  );
}

/** Mode buttons for one pick (the typed view's mode pill opens these). */
export function PickModes({ pick: p, onChange }: { pick: RaidPick; onChange: (p: RaidPick) => void }) {
  const opt = RAID_OPTIONS.find((r) => r.id === p.raid)!;
  if (p.raid === 'toa') return <ToaLevelField bar={p.toa ?? DEFAULT_TOA} onChange={(b) => onChange({ ...p, toa: b ?? DEFAULT_TOA })} />;
  return (
    <div role="group" aria-label={`${opt.label} modes`} className="flex flex-wrap gap-1.5">
      {opt.modes.map((m) => {
        const on = !!p.modes?.includes(m.id);
        return (
          <Chip
            key={m.id}
            pressed={on}
            onClick={() => {
              const modes = on ? (p.modes ?? []).filter((x) => x !== m.id) : [...(p.modes ?? []), m.id];
              if (modes.length === 0) return;
              const next: RaidPick = { ...p, modes: opt.modes.map((x) => x.id).filter((x) => modes.includes(x)) };
              if (next.challenge && !raidOffers(p.raid, next.modes ?? []).challenge) delete next.challenge;
              onChange(next);
            }}
          >
            {m.label}
          </Chip>
        );
      })}
    </div>
  );
}

/** The "pick from a list" grid: one card per raid (two-up), any pick typed twice gets its own card. */
export function RaidCardGrid({ conditions, onChange }: { conditions: TileConditions; onChange: (c: TileConditions) => void }) {
  const picks = conditions.raids ?? [];
  const setPicks = (raids: RaidPick[]) => onChange({ ...conditions, raids });
  const cards: { raid: RaidId; index: number | null }[] = [];
  for (const r of RAID_OPTIONS) {
    const mine = picks.map((p, i) => ({ p, i })).filter((x) => x.p.raid === r.id);
    if (mine.length === 0) cards.push({ raid: r.id, index: null });
    else for (const m of mine) cards.push({ raid: r.id, index: m.i });
  }
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 items-start">
      {cards.map((c) => (
        <RaidCard
          key={`${c.raid}-${c.index ?? 'new'}`}
          raid={c.raid}
          pick={c.index != null ? picks[c.index] : null}
          onChange={(p) => {
            if (c.index == null) {
              if (p) setPicks([...picks, p.raid === 'toa' ? p : { ...newPick(p.raid), ...p, modes: p.modes ?? defaultModes(p.raid) }]);
              return;
            }
            setPicks(p ? picks.map((x, i) => (i === c.index ? p : x)) : picks.filter((_, i) => i !== c.index));
          }}
        />
      ))}
    </div>
  );
}

// ─── Every raid ──────────────────────────────────────────────────────────────────────────────

/** "Every raid:" — nobody dies, teammates (and counted once), the count at the start. */
export function TileRules({
  conditions,
  onChange,
  teamPlay = true,
  startCount = true,
}: {
  conditions: TileConditions;
  onChange: (c: TileConditions) => void;
  teamPlay?: boolean;
  startCount?: boolean;
}) {
  const c = conditions;
  const set = (patch: Partial<TileConditions>) => {
    const next = { ...c, ...patch };
    for (const k of Object.keys(patch) as (keyof TileConditions)[]) if (next[k] == null || next[k] === false) delete next[k];
    onChange(next);
  };
  const mates = c.mates;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-sm font-semibold mr-1">Every raid:</span>
        {!c.noDeaths && <AddChip onClick={() => set({ noDeaths: true })}>+ No deaths</AddChip>}
        {teamPlay && !mates && <AddChip onClick={() => set({ mates: { min: 2 } })}>+ Teammates</AddChip>}
        {startCount && !c.startCount && <AddChip onClick={() => set({ startCount: { op: 'lt', n: 1 } })}>+ Kill count at the start</AddChip>}
      </div>
      {c.noDeaths && (
        <ConditionRow onRemove={() => set({ noDeaths: undefined })} removeLabel="Remove: nobody dies">
          <span className="min-h-9 inline-flex items-center">Nobody in the party dies</span>
        </ConditionRow>
      )}
      {mates && (
        <ConditionRow onRemove={() => set({ mates: undefined, shared: undefined })} removeLabel="Remove the teammates rule">
          <Chip pressed={!('all' in mates)} onClick={() => set({ mates: { min: 'min' in mates ? mates.min : 2 } })}>At least</Chip>
          {'min' in mates && (
            <>
              <NumberInput value={mates.min} onChange={(n) => set({ mates: { min: Math.max(1, n ?? 1) } })} label="Players from the team inside" min={1} max={100} className="w-12" />
              <span>of the team inside</span>
            </>
          )}
          <Chip pressed={'all' in mates} onClick={() => set({ mates: { all: true } })}>Everyone on the team</Chip>
          <Chip pressed={c.shared === 'together'} onClick={() => set({ shared: c.shared === 'together' ? undefined : 'together' })} label="Several teammates in one raid count it once">
            Counted once
          </Chip>
        </ConditionRow>
      )}
      {startCount && c.startCount && (
        <ConditionRow onRemove={() => set({ startCount: undefined })} removeLabel="Remove the start count">
          <Select
            value={c.startCount.op}
            onChange={(v) => set({ startCount: { op: v as StartCount['op'], n: c.startCount!.n } })}
            options={[{ value: 'lt', label: 'Fewer than' }, { value: 'gt', label: 'More than' }]}
            ariaLabel="Fewer or more than"
            className="w-32"
          />
          <NumberInput value={c.startCount.n} onChange={(n) => set({ startCount: { op: c.startCount!.op, n: n ?? 1 } })} label="Raid count when the event starts" min={c.startCount.op === 'lt' ? 1 : 0} />
          <span>clears when the event starts</span>
        </ConditionRow>
      )}
    </div>
  );
}
