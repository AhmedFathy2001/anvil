'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TileCsvRow } from '@/lib/csvTiles';
import { EVENT_MODES as MODES, type EventMode as Mode } from '@/lib/eventModes';
import { BOSSES, EFFICIENCY_METRICS, SKILLS, SKILL_LABELS } from '@/lib/constants';
import type { EventPreset } from '@/lib/eventPresets';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import BoardShape from '@/components/BoardShape';
import DateRangeField from '@/components/DateRangeField';
import TileLibraryDraw from '@/components/TileLibraryDraw';
import type { LibraryTask } from '@/lib/tileLibrary';

interface EventFormProps {
  presets?: EventPreset[];
  suggestedName?: string;
}

/**
 * The four modes that are one board.
 *
 * Showdown, Lucky draw, Bounty and Ladder all store a points-scored task pool; what separates them
 * is `rules.revealPolicy` and, for the ladder, whether people compete as teams or individuals. They
 * stay as named presets because that's what people call them — but they're presets of one format,
 * not four formats.
 */
const POOL_MODES: Mode[] = ['showdown', 'luckydraw', 'bounty', 'ladder'];

const POOL_PRESETS: { mode: Mode; label: string; blurb: string }[] = [
  { mode: 'luckydraw', label: 'Lucky draw', blurb: 'Teams · a random draw opens tasks on a timer' },
  { mode: 'showdown', label: 'Showdown', blurb: 'Teams · each task opens at a time you set' },
  { mode: 'bounty', label: 'Bounty hunt', blurb: 'Teams · one task at a time, first to finish claims it' },
  { mode: 'ladder', label: 'Ladder', blurb: 'Individuals · a rotating pool ranked on one leaderboard' },
];

/** 'SOTW: Agility' — what a competition calls itself when you don't rename it. */
function defaultWeeklyTitle(type: 'skill' | 'boss' | 'efficiency', metric: string): string {
  const label =
    type === 'skill'
      ? SKILL_LABELS[metric] ?? metric
      : type === 'boss'
        ? BOSSES.find((b) => b.key === metric)?.label ?? metric
        : EFFICIENCY_METRICS.find((m) => m.key === metric)?.label ?? metric.toUpperCase();
  return `${type === 'boss' ? 'BOTW' : type === 'efficiency' ? 'Efficiency' : 'SOTW'}: ${label}`;
}

/** The weekly competitions, offered beside the board formats — same page, different table. */
const WEEKLY_KINDS = [
  { type: 'skill' as const, label: 'Skill of the Week', emoji: '📈', chips: 'everyone · xp gained', defaultMetric: 'attack' },
  { type: 'boss' as const, label: 'Boss of the Week', emoji: '💀', chips: 'everyone · kills gained', defaultMetric: 'zulrah' },
  { type: 'efficiency' as const, label: 'Efficiency race', emoji: '⏱', chips: 'everyone · EHP / EHB', defaultMetric: 'ehp' },
];

/** One "this costs you" row in the panel. */
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-gold/10 last:border-b-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right text-foreground/90">{value}</dd>
    </div>
  );
}

/**
 * The coming Saturday at 18:00 local, through the Sunday night after it.
 * `weeksAhead` shifts it whole weeks for the longer presets.
 */
function weekendSlot(weeksAhead: number): { start: string; end: string } {
  const start = new Date();
  const daysUntilSaturday = (6 - start.getDay() + 7) % 7 || 7;
  start.setDate(start.getDate() + daysUntilSaturday + weeksAhead * 7);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(22, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** A titled block of related controls — the form is long enough that flat stacking stopped reading. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-card-border rounded-xl bg-brown-dark/30 p-4">
      <h3 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function EventForm({ presets = [], suggestedName = '' }: EventFormProps) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName);
  const [mode, setMode] = useState<Mode>('classic');
  const [size, setSize] = useState(5);
  // Reveal-policy config (showdown / lucky draw / bounty modes — see lib/eventRules). Only sent
  // when the chosen mode carries a revealPolicy; the values mirror EventRules' clamps.
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [batchSize, setBatchSize] = useState(1);
  // Ladder rotation is a sub-choice within the one 'ladder' mode: progressive (interval),
  // one-at-a-time (bounty) or a rotating window (rotating). Other reveal modes fix their policy.
  const [ladderRotation, setLadderRotation] = useState<'interval' | 'bounty' | 'rotating'>('interval');
  const [windowSize, setWindowSize] = useState(3);
  const [revealOrder, setRevealOrder] = useState<'random' | 'sequential'>('random');
  const [firstBonus, setFirstBonus] = useState(0);
  const [decayEnabled, setDecayEnabled] = useState(false);
  // Time-scaling of a tile's points: 'decay' falls to a floor (<100%), 'grow' rises to a cap (>100%).
  const [decayMode, setDecayMode] = useState<'decay' | 'grow'>('decay');
  const [decayTargetPct, setDecayTargetPct] = useState(50);
  const [decayHours, setDecayHours] = useState(24);
  const [lockout, setLockout] = useState(false);
  // Multi-account enrollment (per event). maxAccounts=1 keeps classic one-account-per-person and
  // hides the mode selectors (they're moot at 1). All of a person's accounts land on ONE team.
  const [maxAccounts, setMaxAccounts] = useState(1);
  const [accountSlotMode, setAccountSlotMode] = useState<'per-person' | 'per-account'>('per-person');
  const [feeMode, setFeeMode] = useState<'per-person' | 'per-account'>('per-person');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  // Starter tile labels carried by a chosen preset (blank until picked). Merged into the
  // create payload so the board arrives pre-seeded.
  const [presetLabels, setPresetLabels] = useState<string[] | null>(null);
  // Full tile config carried by a *saved* preset (parsed CSV rows). Only set when a custom
  // preset is applied — there's no manual CSV upload on create anymore; rich tile authoring
  // happens on the Tiles tab (which has the friendlier spreadsheet + paste tools).
  const [presetCsv, setPresetCsv] = useState<{ rows: TileCsvRow[]; labels: string[]; source: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Schedule, set here rather than after the fact. An event created without dates lands in the
  // events list as "no dates yet" — legitimate for a draft, a nuisance when you knew the dates all
  // along and had to open Settings to say so.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customDates, setCustomDates] = useState(false);
  // A weekly competition is an event too — same page, same name field, same schedule. It just
  // stores itself in the competition tables, so picking one of these switches where we POST.
  const [weeklyType, setWeeklyType] = useState<'skill' | 'boss' | 'efficiency' | null>(null);
  const [weeklyMetric, setWeeklyMetric] = useState('attack');
  const [includeGuests, setIncludeGuests] = useState(true);
  // Where the board's tiles come from: nothing (fill them in later), a saved/built-in template, or
  // a random draw from the clan's task library.
  const [startFrom, setStartFrom] = useState<'blank' | 'template' | 'generate'>('blank');
  const [drawn, setDrawn] = useState<LibraryTask[] | null>(null);

  const meta = MODES.find((m) => m.key === mode)!;
  // The reveal policy actually in effect: a ladder uses its rotation sub-choice; every other mode
  // uses its fixed preset policy. Drives the config UI + the create payload.
  const effectivePolicy = mode === 'ladder' ? ladderRotation : meta.revealPolicy;

  // How many tiles this board will actually have — N² for a square grid, N otherwise. The generator
  // draws against this number, and the create API rejects a mismatch.
  const expectedTiles = meta.square ? size * size : size;

  // The three things you'll do after pressing create, in this format's terms.
  const nextSteps = [
    presetCsv || presetLabels || drawn
      ? `Check the ${expectedTiles} tiles that came with it`
      : expectedTiles > 40
        ? `Author ${expectedTiles} tiles — the spreadsheet round-trip is faster past forty`
        : `Author ${expectedTiles} tiles — paste a list, or draw from your library`,
    meta.chips[0] === 'individual'
      ? 'Set the rotation — how many tasks are open, and for how long'
      : effectivePolicy && effectivePolicy !== 'all'
        ? 'Set when tiles open, then build teams'
        : 'Build teams — draft with an order, or assign from the roster',
    startDate ? 'Leave it — it starts on schedule by itself' : 'Start it when you\'re ready',
  ];

  const isPool = POOL_MODES.includes(mode);
  // Which pool preset the card lands on when you pick it cold — the most-used one.
  const poolMode: Mode = isPool ? mode : 'luckydraw';

  /**
   * Change how tasks open without leaving the pool. On a ladder the policy rides on the same mode;
   * on a team board each policy has its own preset key, which is all that key ever meant.
   */
  function setPoolPolicy(next: 'scheduled' | 'interval' | 'bounty' | 'rotating') {
    if (mode === 'ladder') {
      setLadderRotation(next === 'scheduled' ? 'interval' : next);
      return;
    }
    changeMode(next === 'scheduled' ? 'showdown' : next === 'bounty' ? 'bounty' : 'luckydraw');
  }

  /** Choosing a weekly parks the board config; choosing a board format clears the weekly. */
  function pickWeekly(type: 'skill' | 'boss' | 'efficiency', metric: string) {
    setWeeklyType(type);
    setWeeklyMetric(metric);
    setError('');
    setStartFrom('blank');
    setPresetCsv(null);
    setPresetLabels(null);
    setDrawn(null);
  }

  function changeMode(next: Mode) {
    setWeeklyType(null);
    const m = MODES.find((x) => x.key === next)!;
    setMode(next);
    setSize(m.default);
    setPresetCsv(null);
    setActivePreset(null);
    setPresetLabels(null);
    setDrawn(null);
    setError('');
  }

  function applyPreset(preset: EventPreset) {
    setStartFrom('template');
    setDrawn(null);
    setMode(preset.mode);
    setSize(preset.size);
    setActivePreset(preset.key);
    setError('');
    // A saved template carries full tile config as parsed CSV; a built-in only carries labels.
    if (preset.csv) {
      setPresetCsv({ rows: preset.csv.rows, labels: preset.csv.labels, source: preset.label });
      setPresetLabels(null);
    } else {
      setPresetCsv(null);
      setPresetLabels(preset.tileLabels ?? null);
    }
    // Only auto-fill the name if the user hasn't typed their own (keeps the suggestion).
    if (!name.trim() || name === suggestedName) setName(suggestedName);
  }

  async function deletePreset(preset: EventPreset) {
    if (preset.id == null) return;
    if (!confirm(`Delete the saved template "${preset.label}"? This can't be undone.`)) return;
    await fetch(`/api/admin/event-presets/${preset.id}`, { method: 'DELETE' }).catch(() => {});
    if (activePreset === preset.key) changeMode(mode);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // A weekly competition stores itself in its own tables, so it has its own endpoint — but from
    // here it's the same act: name it, say when it runs, press create.
    if (weeklyType) {
      if (!startDate || !endDate) {
        setError('A competition needs a start and an end — pick a window on the right.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/admin/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: weeklyType,
            metric: weeklyMetric,
            title: name.trim() || defaultWeeklyTitle(weeklyType, weeklyMetric),
            startDate,
            endDate,
            includeGuests,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Could not create the competition.');
          setLoading(false);
          return;
        }
        router.push(`/admin/events/weekly/${data.id ?? data.competition?.id ?? ''}`);
        return;
      } catch {
        setError('Could not create the competition.');
        setLoading(false);
        return;
      }
    }

    // A generated board must line up with the board's tile count before we create anything —
    // the create API rejects a mismatch, and failing here says why in the user's own terms.
    if (startFrom === 'generate') {
      if (!drawn || drawn.length === 0) {
        setError('Draw some tasks from the library first, or switch to a blank board.');
        return;
      }
      if (drawn.length !== expectedTiles) {
        setError(`Drew ${drawn.length} tasks but this board needs ${expectedTiles}. Adjust the counts or the board size.`);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          boardSize: size,
          format: meta.format,
          scoringMode: meta.scoringMode,
          maxAccountsPerPerson: maxAccounts,
          accountSlotMode,
          feeMode,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(effectivePolicy
            ? {
                rules: {
                  revealPolicy: effectivePolicy,
                  revealIntervalMinutes: intervalMinutes,
                  revealBatchSize: batchSize,
                  revealWindowSize: windowSize,
                  revealOrder,
                  firstBonus,
                  decay: decayEnabled ? { targetPct: decayTargetPct, hours: decayHours } : null,
                  lockout,
                },
              }
            : {}),
          ...(startFrom === 'generate' && drawn
            ? { tileLabels: drawn.map((t) => t.label) }
            : presetCsv
              ? { tileLabels: presetCsv.labels }
              : presetLabels
                ? { tileLabels: presetLabels }
                : {}),
        }),
      });
      const data: { id?: number; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setError(data.error || 'Failed to create event');
        setLoading(false);
        return;
      }

      // Rich per-tile config (a saved template's, or the library tasks just drawn) rides in through
      // the shared importer rather than the create API, which only speaks labels. The event already
      // exists with the right labels either way, so a failed import degrades to a named-but-blank
      // board instead of losing the event.
      const richRows = startFrom === 'generate' && drawn
        ? drawn.map((t) => ({ ...t.config, label: t.label, points: t.points, category: t.category ?? undefined }))
        : presetCsv?.rows;
      if (richRows && richRows.length > 0) {
        await fetch(`/api/events/${data.id}/tiles/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: richRows }),
        }).catch(() => {});
      }

      router.push(`/admin/events/${data.id}`);
      router.refresh();
    } catch {
      setError('Failed to create event');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-6 lg:items-start space-y-5 lg:space-y-0">
        <div className="space-y-5 min-w-0">
          {/* Where the tiles come from. Blank stays the default — most boards are authored by hand
              on the Tiles tab, and the other two are opt-in. */}
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Start from</label>
            <div className="flex flex-wrap gap-2">
              {([
                ['blank', 'Blank board'],
                ['template', 'A template'],
                ['generate', 'Draw from library'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setStartFrom(key);
                    if (key !== 'generate') setDrawn(null);
                    if (key !== 'template') {
                      setActivePreset(null);
                      setPresetCsv(null);
                      setPresetLabels(null);
                    }
                  }}
                  aria-pressed={startFrom === key}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    startFrom === key
                      ? 'bg-gold/15 border-gold text-gold'
                      : 'border-card-border text-text-muted hover:border-gold/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {startFrom === 'generate' && (
            <Section title="Draw from the task library">
              <TileLibraryDraw target={expectedTiles} drawn={drawn} onDrawn={setDrawn} />
            </Section>
          )}

          {/* Template gallery — one click pre-fills mode + size (+ any saved tiles). */}
          {startFrom === 'template' && presets.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Start from a template</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {presets.map((p) => {
                const active = activePreset === p.key;
                return (
                  <div key={p.key} className="relative">
                    <button
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        active
                          ? 'bg-gold/20 border-gold'
                          : 'border-card-border hover:border-gold/50 bg-brown-dark/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span aria-hidden className="text-base leading-none">{p.emoji}</span>
                        <span className={`text-sm font-medium ${active ? 'text-gold' : ''}`}>{p.label}</span>
                        {p.custom && (
                          <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            saved
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 leading-snug pr-4">{p.blurb}</p>
                    </button>
                    {p.custom && p.id != null && (
                      <button
                        type="button"
                        onClick={() => deletePreset(p)}
                        aria-label={`Delete template ${p.label}`}
                        className="absolute top-1.5 right-1.5 text-text-muted hover:text-red-400 text-xs px-1"
                      >
                        Ã
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-muted mt-1.5">Or set it up manually below.</p>
          </div>
        )}

          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Event name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
              placeholder="Summer Bingo 2026"
            />
          </div>

          {/* Format — one choice drives format + scoring + reveal policy. Each card carries a
              diagram of the board it produces, because the names alone never said enough. */}
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Format</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MODES.filter((m) => !POOL_MODES.includes(m.key)).map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => changeMode(m.key)}
                    aria-pressed={active}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-gold/15 border-gold'
                        : 'border-card-border hover:border-gold/50 bg-brown-dark/30'
                    }`}
                  >
                    <span className="flex items-center justify-center h-8 mb-2">
                      <BoardShape mode={m.key} size={active ? size : undefined} />
                    </span>
                    <span className={`block text-sm font-medium leading-tight ${active ? 'text-gold' : ''}`}>
                      {m.label}
                    </span>
                    <span className="block text-[10px] text-text-muted mt-1 leading-tight">
                      {m.chips.join(' · ')}
                    </span>
                  </button>
                );
              })}

              {/* Showdown, Lucky draw, Bounty and Ladder are the same board — a points-scored pool of
                  tasks — differing only in who competes and when tasks open. They were four cards
                  pretending to be four formats; now they're one with those two knobs. */}
              <button
                type="button"
                onClick={() => changeMode(poolMode)}
                aria-pressed={isPool}
                className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  isPool ? 'bg-gold/15 border-gold' : 'border-card-border hover:border-gold/50 bg-brown-dark/30'
                }`}
              >
                <span className="flex items-center justify-center h-8 mb-2">
                  <BoardShape mode={isPool ? mode : 'luckydraw'} size={isPool ? size : undefined} />
                </span>
                <span className={`block text-sm font-medium leading-tight ${isPool ? 'text-gold' : ''}`}>
                  Task pool
                </span>
                <span className="block text-[10px] text-text-muted mt-1 leading-tight">
                  points · tasks open over time
                </span>
              </button>
            </div>

            {isPool && (
              <div className="mt-2 rounded-lg border border-gold/25 bg-gold/[0.04] p-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {POOL_PRESETS.map((preset) => (
                    <button
                      key={preset.mode}
                      type="button"
                      onClick={() => changeMode(preset.mode)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        mode === preset.mode
                          ? 'bg-gold/20 border-gold text-gold'
                          : 'border-card-border text-text-muted hover:border-gold/50'
                      }`}
                      title={preset.blurb}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Who competes</label>
                    <Select
                      value={mode === 'ladder' ? 'individuals' : 'teams'}
                      onChange={(v) => changeMode(v === 'individuals' ? 'ladder' : 'luckydraw')}
                      ariaLabel="Who competes"
                      options={[
                        { value: 'teams', label: 'Teams — drafted, scored together' },
                        { value: 'individuals', label: 'Individuals — one leaderboard, no draft' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">How tasks open</label>
                    <Select
                      value={effectivePolicy ?? 'interval'}
                      onChange={(v) => setPoolPolicy(v as 'scheduled' | 'interval' | 'bounty' | 'rotating')}
                      ariaLabel="How tasks open"
                      options={
                        mode === 'ladder'
                          ? [
                              { value: 'interval', label: 'On a timer — new tasks open and stay open' },
                              { value: 'rotating', label: 'Rotating window — new draws expire the oldest' },
                              { value: 'bounty', label: 'One at a time — first to finish claims it' },
                            ]
                          : [
                              { value: 'interval', label: 'On a timer — new tasks open and stay open' },
                              { value: 'bounty', label: 'One at a time — first to finish claims it' },
                              { value: 'scheduled', label: 'Per-tile times — you set each one on the Tiles tab' },
                            ]
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Both are changeable after it exists, from the event&rsquo;s Rules &amp; dates — without
                  rebuilding the board.
                </p>
              </div>
            )}

            <p className="text-[11px] uppercase tracking-widest text-text-muted mt-4 mb-1.5">
              Whole clan · no sign-up
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEEKLY_KINDS.map((w) => {
                const active = weeklyType === w.type;
                return (
                  <button
                    key={w.type}
                    type="button"
                    onClick={() => pickWeekly(w.type, w.defaultMetric)}
                    aria-pressed={active}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      active ? 'bg-purple-400/15 border-purple-400' : 'border-card-border hover:border-purple-400/50 bg-brown-dark/30'
                    }`}
                  >
                    <span className="flex items-center justify-center h-8 mb-2 text-lg" aria-hidden>
                      {w.emoji}
                    </span>
                    <span className={`block text-sm font-medium leading-tight ${active ? 'text-purple-300' : ''}`}>
                      {w.label}
                    </span>
                    <span className="block text-[10px] text-text-muted mt-1 leading-tight">{w.chips}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {weeklyType && (
            <Section title="Competition">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1.5">
                  {weeklyType === 'boss' ? 'Boss' : weeklyType === 'efficiency' ? 'Measure' : 'Skill'}
                </label>
                <Select
                  value={weeklyMetric}
                  onChange={setWeeklyMetric}
                  ariaLabel="What the competition ranks by"
                  options={
                    weeklyType === 'skill'
                      ? SKILLS.map((k) => ({ value: k, label: SKILL_LABELS[k] ?? k }))
                      : weeklyType === 'boss'
                        ? BOSSES.map((b) => ({ value: b.key, label: b.label }))
                        : EFFICIENCY_METRICS.map((m) => ({ value: m.key, label: m.label }))
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={includeGuests}
                  onChange={(e) => setIncludeGuests(e.target.checked)}
                  className="accent-[var(--gold,#d4af37)]"
                />
                Guests race too
              </label>
              <p className="text-xs text-text-muted">
                Everyone on the roster is entered automatically when it starts — there&rsquo;s nothing to draft and
                no sign-up. Baselines come from the hiscores at the start time.
              </p>
            </Section>
          )}

          {!weeklyType && <Section title="Board">
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-1.5">{meta.sizeLabel}</label>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={size}
                  onChange={(n) => {
                    setSize(n);
                    setPresetCsv(null);
                    setActivePreset(null);
                    setPresetLabels(null);
                  }}
                  min={meta.min}
                  max={meta.max}
                  fallback={meta.default}
                  required
                  disabled={!!presetCsv}
                  className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold disabled:opacity-60"
                />
                <span className="text-sm text-text-muted">
                  {presetCsv ? `from ${presetCsv.source}` : meta.sizeHelp(size)}
                </span>
              </div>
            </div>
          </Section>}

          {/* Reveal-policy config — modes that hide tiles (showdown / lucky draw / bounty) and the
              ladder's rotation sub-choice. */}
          {effectivePolicy && (
            <Section title="Reveal & scoring">
              {mode === 'ladder' && (
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1.5">Task rotation</label>
                  <Select
                    value={ladderRotation}
                    onChange={(v) => setLadderRotation(v as 'interval' | 'bounty' | 'rotating')}
                    ariaLabel="Task rotation"
                    options={[
                      { value: 'interval', label: 'Progressive — new tasks appear on a timer and stay open' },
                      { value: 'rotating', label: 'Rotating window — a few open at once; new draws expire the oldest' },
                      { value: 'bounty', label: 'One at a time — first to finish claims it, next is drawn' },
                    ]}
                  />
                </div>
              )}
              <p className="text-xs text-text-muted leading-relaxed">
                {effectivePolicy === 'scheduled' &&
                  'Tiles stay hidden until their scheduled time. Set each tile’s reveal moment on the Tiles tab after creating the event.'}
                {effectivePolicy === 'interval' &&
                  'Hidden tasks go live automatically on the interval below, starting the moment the event begins, and stay open.'}
                {effectivePolicy === 'rotating' &&
                  'A rolling window of open tasks: each draw opens new random tasks and expires the oldest so only the window size stays live.'}
                {effectivePolicy === 'bounty' &&
                  'One tile is open at a time. The first team to complete it claims the points and the next bounty is drawn immediately.'}
              </p>
              {effectivePolicy === 'rotating' && (
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1.5">Open tasks at once (window)</label>
                  <NumberInput
                    value={windowSize}
                    onChange={setWindowSize}
                    min={1}
                    max={50}
                    fallback={3}
                    className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                  />
                </div>
              )}
              {(effectivePolicy === 'interval' || effectivePolicy === 'rotating') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground/70 mb-1.5">Minutes between draws</label>
                    <NumberInput
                      value={intervalMinutes}
                      onChange={setIntervalMinutes}
                      min={5}
                      max={10080}
                      fallback={60}
                      className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground/70 mb-1.5">Tiles per draw</label>
                    <NumberInput
                      value={batchSize}
                      onChange={setBatchSize}
                      min={1}
                      max={50}
                      fallback={1}
                      className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
              )}
              {(effectivePolicy === 'interval' || effectivePolicy === 'bounty' || effectivePolicy === 'rotating') && (
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1.5">Draw order</label>
                  <Select
                    value={revealOrder}
                    onChange={(v) => setRevealOrder(v as 'random' | 'sequential')}
                    ariaLabel="Draw order"
                    options={[
                      { value: 'random', label: 'Random — any hidden tile can be next' },
                      { value: 'sequential', label: 'Board order — tiles appear in position order' },
                    ]}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1.5">First-team bonus points</label>
                <div className="flex items-center gap-2">
                  <NumberInput
                    value={firstBonus}
                    onChange={setFirstBonus}
                    min={0}
                    max={100000}
                    fallback={0}
                    className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                  />
                  <span className="text-sm text-text-muted">
                    {firstBonus > 0
                      ? `First team to finish a tile earns +${firstBonus} on top of its points.`
                      : '0 = no first-finisher bonus.'}
                  </span>
                </div>
              </div>

              {/* Point value over time — a tile's points slide from 100% toward a target as it ages.
                  Decay (target < 100) rewards racing; growth (target > 100) rewards clearing older tasks. */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground/70">
                  <input
                    type="checkbox"
                    checked={decayEnabled}
                    onChange={(e) => setDecayEnabled(e.target.checked)}
                    className="accent-[var(--gold,#d4af37)]"
                  />
                  Point value changes over time
                </label>
                {decayEnabled && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-text-muted mb-1">Direction</label>
                      <Select
                        value={decayMode}
                        onChange={(v) => {
                          const m = v as 'decay' | 'grow';
                          setDecayMode(m);
                          // Snap the target into the sensible range for the new direction.
                          setDecayTargetPct(m === 'grow' ? Math.max(101, decayTargetPct) : Math.min(99, decayTargetPct));
                        }}
                        ariaLabel="Point value direction"
                        options={[
                          { value: 'decay', label: 'Decay — worth less the longer it’s out' },
                          { value: 'grow', label: 'Grow — worth more the longer it’s out' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">
                        {decayMode === 'grow' ? 'Cap (% of full points)' : 'Floor (% of full points)'}
                      </label>
                      <NumberInput
                        value={decayTargetPct}
                        onChange={setDecayTargetPct}
                        min={decayMode === 'grow' ? 101 : 0}
                        max={decayMode === 'grow' ? 1000 : 100}
                        fallback={decayMode === 'grow' ? 150 : 50}
                        className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Hours to reach it</label>
                      <NumberInput
                        value={decayHours}
                        onChange={setDecayHours}
                        min={1}
                        max={720}
                        fallback={24}
                        className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                      />
                    </div>
                    <p className="col-span-2 text-[11px] text-text-muted leading-relaxed">
                      A tile completed the moment it’s revealed pays full points, sliding linearly to{' '}
                      {decayTargetPct}% after {decayHours}h{decayMode === 'decay' && decayTargetPct === 0 ? ' (down to nothing)' : ''}.
                      Earned points freeze at completion time. Pair with the rotating-window rotation to also
                      close the task when it ages out.
                    </p>
                  </div>
                )}
              </div>

              {/* Lockout — bounty is single-claim by definition, so only offer it on the other modes. */}
              {effectivePolicy !== 'bounty' && (
                <label className="flex items-center gap-2 text-sm font-medium text-foreground/70">
                  <input
                    type="checkbox"
                    checked={lockout}
                    onChange={(e) => setLockout(e.target.checked)}
                    className="accent-[var(--gold,#d4af37)]"
                  />
                  Lockout — the first team to finish a tile locks it for everyone else
                </label>
              )}
            </Section>
          )}

          <Section title="Entries">
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-1.5">Accounts per person</label>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={maxAccounts}
                  onChange={setMaxAccounts}
                  min={1}
                  max={10}
                  fallback={1}
                  className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                />
                <span className="text-sm text-text-muted">
                  {maxAccounts <= 1
                    ? 'One account each (classic).'
                    : `Each person may enter up to ${maxAccounts} of their accounts — all on the same team.`}
                </span>
              </div>
            </div>

            {maxAccounts > 1 && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1.5">Team-size &amp; MVP counting</label>
                  <Select
                    value={accountSlotMode}
                    onChange={(v) => setAccountSlotMode(v as 'per-person' | 'per-account')}
                    ariaLabel="Team-size and MVP counting"
                    options={[
                      { value: 'per-person', label: 'Per person — N accounts = 1 slot; MVP aggregates the person' },
                      { value: 'per-account', label: 'Per account — N accounts = N slots; MVP lists each account' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1.5">Sign-up fee</label>
                  <Select
                    value={feeMode}
                    onChange={(v) => setFeeMode(v as 'per-person' | 'per-account')}
                    ariaLabel="Sign-up fee mode"
                    options={[
                      { value: 'per-person', label: 'Per person — one fee' },
                      { value: 'per-account', label: 'Per account — a fee per entered account' },
                    ]}
                  />
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Live preview — what the choices above actually produce. Sticky on wide screens so it
            stays in view while the config scrolls past it. */}
        <aside className="lg:sticky lg:top-4 space-y-3">
          <div className="border border-gold/25 rounded-xl bg-gold/5 p-4">
            <h3 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">You&apos;ll get</h3>
            <div className="flex justify-center py-1 mb-3">
              <BoardShape mode={mode} size={size} variant="panel" />
            </div>
            <p className="text-sm font-medium text-gold">{meta.label}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {presetCsv ? `${presetCsv.labels.length} tiles from ${presetCsv.source}` : meta.sizeHelp(size)}
            </p>

            {/* What this format actually costs you in work — the thing you find out the hard way
                otherwise. Read off the same mode metadata the picker uses. */}
            <dl className="mt-3 border-t border-gold/15 pt-3 text-xs">
              <SpecRow label="Tiles to author" value={presetCsv ? 'already written' : String(expectedTiles)} />
              <SpecRow label="Scoring" value={meta.chips[1]} />
              <SpecRow
                label="Teams"
                value={meta.chips[0] === 'individual' ? 'none needed — no draft' : 'draft, or assign by hand'}
              />
              <SpecRow label="Tiles open" value={meta.chips[2]} />
              <SpecRow label="Entries" value={maxAccounts > 1 ? `up to ${maxAccounts} accounts each` : '1 account each'} />
            </dl>

            <ol className="mt-3 border-t border-gold/15 pt-3 space-y-1.5">
              {nextSteps.map((step, i) => (
                <li key={step} className="text-xs text-text-muted leading-relaxed flex gap-2">
                  <span aria-hidden className="text-gold/70 font-mono">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="border border-card-border rounded-xl bg-card-bg p-4">
            <h3 className="text-[11px] uppercase tracking-widest text-text-muted mb-2">Runs</h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const { start, end } = weekendSlot(0);
                  setStartDate(start);
                  setEndDate(end);
                  setCustomDates(false);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  !customDates && startDate ? 'border-gold/50 text-gold bg-gold/10' : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                This weekend
              </button>
              <button
                type="button"
                onClick={() => {
                  const { start } = weekendSlot(0);
                  setStartDate(start);
                  setEndDate(new Date(Date.parse(start) + 14 * 86_400_000).toISOString());
                  setCustomDates(false);
                }}
                className="text-xs px-2.5 py-1 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
              >
                Two weeks
              </button>
              <button
                type="button"
                onClick={() => setCustomDates((v) => !v)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  customDates ? 'border-gold/50 text-gold bg-gold/10' : 'border-card-border text-text-muted hover:text-foreground'
                }`}
              >
                Pick dates…
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setCustomDates(false);
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg text-text-muted hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {customDates && (
              <div className="mt-3">
                <DateRangeField
                  startIso={startDate}
                  endIso={endDate}
                  onChange={({ startIso, endIso }) => {
                    setStartDate(startIso);
                    setEndDate(endIso);
                  }}
                  allowOpenEnded
                />
              </div>
            )}

            <p className="text-xs text-text-muted mt-2">
              {startDate ? (
                <span suppressHydrationWarning>
                  {new Date(startDate).toLocaleString()}
                  {endDate ? ` → ${new Date(endDate).toLocaleString()}` : ' → open-ended'}
                </span>
              ) : (
                'No dates — it starts when you say so.'
              )}
            </p>
          </div>
        </aside>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gold hover:bg-gold-light text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating…' : weeklyType ? 'Create competition' : 'Create Event'}
      </button>
      <p className="text-xs text-text-muted text-center">
        {weeklyType
          ? 'Everyone on the roster is entered when it starts — nothing else to set up.'
          : "Next you'll add tiles on the event's Tiles tab — with a spreadsheet (dropdowns + examples) or a quick paste."}
      </p>
    </form>
  );
}
