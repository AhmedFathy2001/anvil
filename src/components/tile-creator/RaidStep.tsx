'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { conditionsSentence, type RaidPick, type TileConditions } from '@/lib/tileConditions';
import { howItCountsLine, type RaidSelection } from '@/lib/tileCreatorConfig';
import {
  RAID_NAME,
  applySuggestion,
  conditionsFromSelection,
  parseRaidQuery,
  pickPills,
  raidConditionsTile,
  raidQuerySuggestions,
  raidQueryText,
  tilePills,
  type PillKey,
  type RaidQueryProblem,
  type TilePillKey,
} from '@/lib/raidQuery';
import type { TaskCandidate } from '@/lib/taskMatch';
import { AmountField, CountsBanner, PrimaryButton, StepHeader } from './parts';
import { PickBars, PickModes, RaidCardGrid, TileRules } from './ConditionFields';

const TRY = ['under 30:00', 'with 3 teammates', 'solo scaled 10', 'first 5'];

/**
 * Raids: one box, typed the way it'd be said in clan chat ("5 cm challenge time, toa 300 solo,
 * deathless"), read back as pills grouped per raid that can be changed or dropped. "Pick from a list
 * instead" shows the same draft as a card per raid. A draft with no conditions (and no Entry) is
 * exactly the hiscores tile the picker always made; any condition makes a raid tile that carries them
 * (lib/raidQuery raidConditionsTile).
 */
export default function RaidStep({
  seed,
  seedConditions,
  amount: initialAmount,
  teamPlay = true,
  onBack,
  onNext,
}: {
  seed?: RaidSelection;
  seedConditions?: TileConditions;
  amount: number | null;
  teamPlay?: boolean;
  onBack: () => void;
  onNext: (candidate: TaskCandidate) => void;
}) {
  const start = useMemo(() => seedConditions ?? conditionsFromSelection(seed), [seed, seedConditions]);
  const [conds, setConds] = useState<TileConditions>(start);
  const [amount, setAmount] = useState<number | null>(initialAmount ?? 5);
  const [text, setText] = useState(() => raidQueryText(start, initialAmount ?? 5));
  const [problems, setProblems] = useState<RaidQueryProblem[]>([]);
  const [view, setView] = useState<'typed' | 'list'>('typed');
  const n = amount && amount > 0 ? amount : 1;
  const tile = raidConditionsTile(conds, n);
  const how = tile.ok ? howItCountsLine(tile.config) : null;

  function typed(next: string) {
    setText(next);
    const r = parseRaidQuery(next);
    setProblems(r.problems);
    setConds(r.conditions);
    if (r.clears != null) setAmount(r.clears);
  }
  // A pill or card changed: the box is rewritten to say the same thing.
  function edited(next: TileConditions, clears: number | null = amount) {
    setConds(next);
    setProblems([]);
    setText(raidQueryText(next, clears));
  }

  function next() {
    if (!tile.ok || !how) return;
    const picks = conds.raids ?? [];
    onNext({
      key: tile.source === 'raid' ? `raidc-${raidQueryText(tile.config.conditions ?? conds, null)}` : `raid-${Object.keys(tile.selection ?? {}).filter((k) => tile.selection![k]).sort().join('+')}`,
      source: 'raid',
      badge: 'Raids',
      title: tile.title,
      titleTemplate: tile.titleTemplate,
      titleOne: tile.titleOne,
      hint: how.text,
      engine: how.engine,
      verb: 'Clear',
      noun: picks.length === 1 ? `${RAID_NAME[picks[0].raid]} raids` : 'raids',
      amountField: tile.source === 'hiscores' ? 'statGoal' : 'requiredAmount',
      amount: n,
      config: tile.config,
      flow: 'raids',
      seed: tile.selection ? { raids: tile.selection, conditions: conds } : { conditions: conds },
      category: 'bosses',
      score: 0,
      confident: true,
    });
  }

  return (
    <div>
      <StepHeader title="Raids" onBack={onBack} />

      {view === 'typed' ? (
        <TypedBox text={text} problems={problems} onText={typed} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-base font-semibold mb-3">
          <span>Clear</span>
          <AmountField value={amount} onChange={(v) => { setAmount(v); edited(conds, v); }} label="Clears needed" />
          <span>of:</span>
        </div>
      )}

      {view === 'typed' ? (
        <Pills conditions={conds} amount={amount} onAmount={(v) => { setAmount(v); edited(conds, v); }} onChange={edited} teamPlay={teamPlay} />
      ) : (
        <div className="flex flex-col gap-3">
          <RaidCardGrid conditions={conds} onChange={edited} />
          <TileRules conditions={conds} onChange={edited} teamPlay={teamPlay} />
        </div>
      )}

      {tile.ok && (conds.raids?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-lg border border-card-border bg-brown-dark/60 px-3 py-2.5 text-sm leading-relaxed" aria-live="polite">
          <span className="block text-[11px] uppercase tracking-widest text-text-muted">Reads as</span>
          Clear {n.toLocaleString('en-US')} of: {conditionsSentence(conds)}
        </div>
      )}

      <div className="mt-3">
        {tile.ok && how ? (
          <CountsBanner
            engine={how.engine}
            text={
              tile.source === 'hiscores'
                ? 'Counts by itself from the hiscores. Nothing to upload. Entry Mode never counts here.'
                : tile.source === 'plugin'
                  ? 'Counts by itself: the plugin reads each raid’s completion line, because an Entry mode is in and Entry isn’t on the hiscores.'
                  : how.text
            }
          />
        ) : (
          <p role="alert" className="text-sm text-red-300">{tile.error}</p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setView(view === 'typed' ? 'list' : 'typed')}
          className="min-h-11 text-sm text-gold hover:text-gold-light underline underline-offset-2"
        >
          {view === 'typed' ? 'Pick from a list instead' : 'Type it instead'}
        </button>
        <PrimaryButton onClick={next} disabled={!tile.ok}>
          Next: points
        </PrimaryButton>
      </div>
    </div>
  );
}

/** The box, its suggestions, and the words it can't use underlined with why. */
function TypedBox({ text, problems, onText }: { text: string; problems: RaidQueryProblem[]; onText: (t: string) => void }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = focused ? raidQuerySuggestions(text) : [];
  const open = suggestions.length > 0;
  const take = (i: number) => {
    const s = suggestions[i];
    if (!s) return;
    onText(applySuggestion(text, s));
    setActive(0);
    ref.current?.focus();
  };
  return (
    <div className="mb-3">
      <label htmlFor={`${id}-q`} className="block text-sm font-semibold mb-1.5">What should players do?</label>
      <div className="relative">
        <input
          ref={ref}
          id={`${id}-q`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          aria-describedby={problems.length ? `${id}-why` : undefined}
          aria-invalid={problems.length > 0 || undefined}
          autoComplete="off"
          spellCheck={false}
          value={text}
          placeholder="e.g. 5 cm challenge time, toa 300 solo, deathless"
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onChange={(e) => { onText(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); take(active); }
            else if (e.key === 'Escape') setFocused(false);
          }}
          className="w-full min-h-12 px-3 rounded-xl border-2 border-gold/50 bg-brown-dark text-base focus:outline-none focus:border-gold placeholder:text-text-muted/60"
        />
        {open && (
          <ul id={`${id}-list`} role="listbox" aria-label="Suggestions" className="absolute z-20 mt-1 w-full rounded-lg border border-card-border bg-brown-dark shadow-xl overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={s.insert}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); take(i); }}
                className={`min-h-11 px-3 flex items-center gap-3 text-sm cursor-pointer ${i === active ? 'bg-gold/10' : 'hover:bg-gold/5'}`}
              >
                <span>{s.insert}</span>
                {s.note && <span className="ml-auto text-xs text-text-muted">{s.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {problems.length > 0 && (
        <div id={`${id}-why`} className="mt-2" aria-live="polite">
          <p className="text-sm break-words" aria-hidden="true">
            <Underlined text={text} problems={problems} />
          </p>
          <ul className="mt-1 space-y-0.5">
            {problems.map((p, i) => (
              <li key={i} className="text-sm text-red-200">
                <span className="font-semibold">“{p.text}”</span>: {p.why}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
        <span>Try:</span>
        {TRY.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onText(`${text.trim()}${text.trim() ? ', ' : ''}${t}`)}
            className="min-h-9 px-2.5 rounded-full border border-card-border text-foreground/80 hover:border-gold/50"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Underlined({ text, problems }: { text: string; problems: RaidQueryProblem[] }) {
  const out: ReactNode[] = [];
  let at = 0;
  for (const [i, p] of [...problems].sort((a, b) => a.start - b.start).entries()) {
    if (p.start < at) continue;
    out.push(text.slice(at, p.start));
    out.push(
      <span key={i} className="underline decoration-wavy decoration-red-400 underline-offset-4">
        {text.slice(p.start, p.end)}
      </span>,
    );
    at = p.end;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

type Editing = { pick: number; key: PillKey } | { tile: TilePillKey } | null;

/** The draft read back: a row of pills per raid and one for the whole tile. Click to change, × to drop. */
function Pills({
  conditions: c,
  amount,
  onAmount,
  onChange,
  teamPlay,
}: {
  conditions: TileConditions;
  amount: number | null;
  onAmount: (n: number | null) => void;
  onChange: (c: TileConditions) => void;
  teamPlay: boolean;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const picks = c.raids ?? [];
  const setPick = (i: number, p: RaidPick | null) =>
    onChange({ ...c, raids: p ? picks.map((x, j) => (j === i ? p : x)) : picks.filter((_, j) => j !== i) });
  const dropBar = (i: number, key: PillKey) => {
    const p = { ...picks[i] };
    if (key === 'party') delete p.party;
    if (key === 'scale') delete p.scale;
    if (key === 'under') delete p.under;
    if (key === 'challenge') delete p.challenge;
    setPick(i, p);
    setEditing(null);
  };
  const dropRule = (key: TilePillKey) => {
    const next = { ...c };
    delete next[key];
    if (key === 'mates') delete next.shared;
    onChange(next);
    setEditing(null);
  };
  const rules = tilePills(c);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span>Players must clear</span>
        <AmountField value={amount} onChange={onAmount} label="Clears needed" />
        <span>of:</span>
      </div>
      {picks.map((p, i) => {
        const open = editing && 'pick' in editing && editing.pick === i ? editing.key : null;
        return (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-11 text-[13px] font-bold">{RAID_NAME[p.raid]}</span>
              {pickPills(p).map((pill) => (
                <Pill
                  key={pill.key}
                  label={pill.label}
                  strong={pill.key === 'modes'}
                  open={open === pill.key}
                  editable={pill.key !== 'challenge'}
                  onEdit={() => setEditing(open === pill.key ? null : { pick: i, key: pill.key })}
                  onRemove={() => (pill.key === 'modes' ? setPick(i, null) : dropBar(i, pill.key))}
                  removeLabel={pill.key === 'modes' ? `Remove ${RAID_NAME[p.raid]}` : `Remove ${pill.label}`}
                />
              ))}
            </div>
            {open && (
              <div className="ml-0 sm:ml-12 rounded-lg border border-card-border bg-brown-dark/50 p-2 flex flex-col gap-1.5">
                {open === 'modes' ? (
                  <PickModes pick={p} onChange={(x) => setPick(i, x)} />
                ) : (
                  <PickBars
                    pick={{ raid: p.raid, modes: p.modes, toa: p.toa, ...(open === 'party' ? { party: p.party } : open === 'scale' ? { scale: p.scale } : open === 'under' ? { under: p.under } : {}) }}
                    onChange={(x) => {
                      const key = open as 'party' | 'scale' | 'under';
                      const next: RaidPick = { ...p, [key]: x[key] };
                      if (x[key] == null) {
                        delete next[key];
                        setEditing(null);
                      }
                      setPick(i, next);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      {rules.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-11 text-[13px] font-bold">All</span>
            {rules.map((r) => {
              const open = !!editing && 'tile' in editing && editing.tile === r.key;
              return (
                <Pill
                  key={r.key}
                  label={r.label}
                  open={open}
                  editable={r.key === 'mates' || r.key === 'startCount'}
                  onEdit={() => setEditing(open ? null : { tile: r.key })}
                  onRemove={() => dropRule(r.key)}
                  removeLabel={`Remove: ${r.label}`}
                />
              );
            })}
          </div>
          {editing && 'tile' in editing && (
            <div className="sm:ml-12 rounded-lg border border-card-border bg-brown-dark/50 p-2">
              <TileRules
                conditions={editing.tile === 'mates' ? { v: 1, mates: c.mates, shared: c.shared } : { v: 1, startCount: c.startCount }}
                onChange={(x) => {
                  const keys: (keyof TileConditions)[] = editing.tile === 'mates' ? ['mates', 'shared'] : ['startCount'];
                  const next: TileConditions = { ...c };
                  for (const k of keys) {
                    if (x[k] == null) delete next[k];
                    else Object.assign(next, { [k]: x[k] });
                  }
                  if (x[keys[0]] == null) setEditing(null);
                  onChange(next);
                }}
                teamPlay={teamPlay}
              />
            </div>
          )}
        </div>
      )}
      {picks.length === 0 && <p className="text-sm text-text-muted">Name a raid: cox, tob, toa, tfa, or “any raid”.</p>}
    </div>
  );
}

function Pill({
  label,
  strong = false,
  open,
  editable,
  onEdit,
  onRemove,
  removeLabel,
}: {
  label: string;
  strong?: boolean;
  open: boolean;
  editable: boolean;
  onEdit: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const tone = strong ? 'border-gold bg-gold/10 text-gold' : 'border-card-border bg-brown-dark text-foreground';
  return (
    <span className={`inline-flex items-stretch rounded-full border text-[13px] ${tone} ${open ? 'ring-1 ring-gold/50' : ''}`}>
      {editable ? (
        <button type="button" onClick={onEdit} aria-expanded={open} className="min-h-9 pl-3 pr-1 rounded-l-full hover:underline underline-offset-2">
          {label}
        </button>
      ) : (
        <span className="min-h-9 pl-3 pr-1 inline-flex items-center">{label}</span>
      )}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="min-h-9 min-w-9 grid place-items-center rounded-r-full text-text-muted hover:text-foreground">
        <span aria-hidden="true">&times;</span>
      </button>
    </span>
  );
}
