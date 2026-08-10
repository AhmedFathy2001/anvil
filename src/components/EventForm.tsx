'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TileCsvRow } from '@/lib/csvTiles';
import { EVENT_MODES as MODES, type EventMode as Mode } from '@/lib/eventModes';
import type { EventPreset } from '@/lib/eventPresets';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import BoardShape from '@/components/BoardShape';

interface EventFormProps {
  presets?: EventPreset[];
  suggestedName?: string;
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

  const meta = MODES.find((m) => m.key === mode)!;
  // The reveal policy actually in effect: a ladder uses its rotation sub-choice; every other mode
  // uses its fixed preset policy. Drives the config UI + the create payload.
  const effectivePolicy = mode === 'ladder' ? ladderRotation : meta.revealPolicy;

  function changeMode(next: Mode) {
    const m = MODES.find((x) => x.key === next)!;
    setMode(next);
    setSize(m.default);
    setPresetCsv(null);
    setActivePreset(null);
    setPresetLabels(null);
    setError('');
  }

  function applyPreset(preset: EventPreset) {
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
          ...(presetCsv ? { tileLabels: presetCsv.labels } : presetLabels ? { tileLabels: presetLabels } : {}),
        }),
      });
      const data: { id?: number; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setError(data.error || 'Failed to create event');
        setLoading(false);
        return;
      }

      // A saved template also carries rich per-tile config — apply it via the shared importer.
      // The event already exists with the right labels, so a failed import is non-fatal.
      if (presetCsv) {
        await fetch(`/api/events/${data.id}/tiles/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: presetCsv.rows }),
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
      {/* Template gallery â one click pre-fills mode + size (+ any saved tiles). */}
        {presets.length > 0 && (
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

          {/* Format â one choice drives format + scoring + reveal policy. Each card carries a
              diagram of the board it produces, because the names alone never said enough. */}
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Format</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODES.map((m) => {
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
            </div>
          </div>

          <Section title="Board">
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
          </Section>

          {/* Reveal-policy config â modes that hide tiles (showdown / lucky draw / bounty) and the
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

              {/* Point value over time â a tile's points slide from 100% toward a target as it ages.
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

              {/* Lockout â bounty is single-claim by definition, so only offer it on the other modes. */}
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

        {/* Live preview â what the choices above actually produce. Sticky on wide screens so it
            stays in view while the config scrolls past it. */}
        <aside className="lg:sticky lg:top-4">
          <div className="border border-gold/25 rounded-xl bg-gold/5 p-4">
            <h3 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">You&apos;ll get</h3>
            <div className="flex justify-center py-2 mb-3">
              <BoardShape mode={mode} size={size} variant="panel" />
            </div>
            <p className="text-sm font-medium text-gold">{meta.label}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {presetCsv ? `${presetCsv.labels.length} tiles from ${presetCsv.source}` : meta.sizeHelp(size)}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {meta.chips.join(' · ')}
              {maxAccounts > 1 ? ` · up to ${maxAccounts} accounts each` : ' · 1 account each'}
            </p>
            <ul className="mt-3 space-y-1.5 border-t border-gold/15 pt-3">
              {meta.how.map((line) => (
                <li key={line} className="text-xs text-text-muted leading-relaxed flex gap-1.5">
                  <span aria-hidden className="text-gold/60">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gold hover:bg-gold-light text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Event'}
      </button>
      <p className="text-xs text-text-muted text-center">
        Next you&apos;ll add tiles on the event&apos;s Tiles tab — with a spreadsheet (dropdowns + examples) or a quick paste.
      </p>
    </form>
  );
}
