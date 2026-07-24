'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TileCsvRow } from '@/lib/csvTiles';
import { EVENT_MODES as MODES, type EventMode as Mode } from '@/lib/eventModes';
import type { EventPreset } from '@/lib/eventPresets';
import Input from '@/components/Input';

interface EventFormProps {
  presets?: EventPreset[];
  suggestedName?: string;
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
  const [revealOrder, setRevealOrder] = useState<'random' | 'sequential'>('random');
  const [firstBonus, setFirstBonus] = useState(0);
  const [decayEnabled, setDecayEnabled] = useState(false);
  const [decayFloorPct, setDecayFloorPct] = useState(50);
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
          ...(meta.revealPolicy
            ? {
                rules: {
                  revealPolicy: meta.revealPolicy,
                  revealIntervalMinutes: intervalMinutes,
                  revealBatchSize: batchSize,
                  revealOrder,
                  firstBonus,
                  decay: decayEnabled ? { floorPct: decayFloorPct, hours: decayHours } : null,
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Template gallery — one click pre-fills mode + size (+ any saved tiles). */}
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
                      ×
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
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Event Name</label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
          placeholder="Summer Bingo 2026"
        />
      </div>

      {/* Mode — one choice drives format + scoring */}
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Type</label>
        <div className="grid sm:grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => changeMode(m.key)}
              className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                mode === m.key ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{meta.blurb}</p>
      </div>

      {/* Size — mode-aware */}
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">{meta.sizeLabel}</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={size}
            onChange={(e) => {
              setSize(parseInt(e.target.value, 10) || meta.default);
              setPresetCsv(null);
              setActivePreset(null);
              setPresetLabels(null);
            }}
            min={meta.min}
            max={meta.max}
            required
            disabled={!!presetCsv}
            className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold disabled:opacity-60"
          />
          <span className="text-sm text-text-muted">
            {presetCsv ? `from ${presetCsv.source}` : meta.sizeHelp(size)}
          </span>
        </div>
      </div>

      {/* Reveal-policy config — only for modes that hide tiles (showdown / lucky draw / bounty). */}
      {meta.revealPolicy && (
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 space-y-3">
          <p className="text-xs text-text-muted leading-relaxed">
            {meta.revealPolicy === 'scheduled' &&
              'Tiles stay hidden until their scheduled time. Set each tile’s reveal moment on the Tiles tab after creating the event.'}
            {meta.revealPolicy === 'interval' &&
              'Hidden tiles go live automatically on the interval below, starting the moment the event begins.'}
            {meta.revealPolicy === 'bounty' &&
              'One tile is open at a time. The first team to complete it claims the points and the next bounty is drawn immediately.'}
          </p>
          {meta.revealPolicy === 'interval' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1.5">Minutes between draws</label>
                <Input
                  type="number"
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Math.max(5, Math.min(10080, parseInt(e.target.value, 10) || 60)))}
                  min={5}
                  max={10080}
                  className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1.5">Tiles per draw</label>
                <Input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                  min={1}
                  max={50}
                  className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                />
              </div>
            </div>
          )}
          {(meta.revealPolicy === 'interval' || meta.revealPolicy === 'bounty') && (
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-1.5">Draw order</label>
              <select
                value={revealOrder}
                onChange={(e) => setRevealOrder(e.target.value as 'random' | 'sequential')}
                className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
              >
                <option value="random">Random — any hidden tile can be next</option>
                <option value="sequential">Board order — tiles appear in position order</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">First-team bonus points</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={firstBonus}
                onChange={(e) => setFirstBonus(Math.max(0, Math.min(100000, parseInt(e.target.value, 10) || 0)))}
                min={0}
                max={100000}
                className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
              />
              <span className="text-sm text-text-muted">
                {firstBonus > 0
                  ? `First team to finish a tile earns +${firstBonus} on top of its points.`
                  : '0 = no first-finisher bonus.'}
              </span>
            </div>
          </div>

          {/* Point decay — a tile is worth less the longer it's been revealed (rewards racing). */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground/70">
              <input
                type="checkbox"
                checked={decayEnabled}
                onChange={(e) => setDecayEnabled(e.target.checked)}
                className="accent-[var(--gold,#d4af37)]"
              />
              Point decay — tiles are worth less the longer they&apos;ve been out
            </label>
            {decayEnabled && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Floor (% of full points)</label>
                  <Input
                    type="number"
                    value={decayFloorPct}
                    onChange={(e) => setDecayFloorPct(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                    min={0}
                    max={100}
                    className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Hours to reach the floor</label>
                  <Input
                    type="number"
                    value={decayHours}
                    onChange={(e) => setDecayHours(Math.max(1, Math.min(720, parseInt(e.target.value, 10) || 24)))}
                    min={1}
                    max={720}
                    className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
                  />
                </div>
                <p className="col-span-2 text-[11px] text-text-muted leading-relaxed">
                  A tile completed the moment it&apos;s revealed pays full points, sliding linearly to {decayFloorPct}%
                  after {decayHours}h. Earned points freeze at completion time.
                </p>
              </div>
            )}
          </div>

          {/* Lockout — bounty is single-claim by definition, so only offer it on the other modes. */}
          {meta.revealPolicy !== 'bounty' && (
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
        </div>
      )}

      {/* Accounts per person — multi-account enrollment (all of a person's accounts on one team). */}
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Accounts per person</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={maxAccounts}
            onChange={(e) => setMaxAccounts(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
            min={1}
            max={10}
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
            <select
              value={accountSlotMode}
              onChange={(e) => setAccountSlotMode(e.target.value as 'per-person' | 'per-account')}
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
            >
              <option value="per-person">Per person — N accounts = 1 slot; MVP aggregates the person</option>
              <option value="per-account">Per account — N accounts = N slots; MVP lists each account</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Sign-up fee</label>
            <select
              value={feeMode}
              onChange={(e) => setFeeMode(e.target.value as 'per-person' | 'per-account')}
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
            >
              <option value="per-person">Per person — one fee</option>
              <option value="per-account">Per account — a fee per entered account</option>
            </select>
          </div>
        </div>
      )}

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
