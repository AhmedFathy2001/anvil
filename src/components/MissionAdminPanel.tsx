'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/Select';
import { parseEventRules, isMissionTile, type MissionAnnounceMode, type RampPhase } from '@/lib/eventRules';
import { phaseWindow } from '@/lib/missionRamp';
import { DEFAULT_TIER_BANDS } from '@/lib/tileFilter';
import type { Tile } from '@/lib/types';

/**
 * Mid-event mission control on the event Overview tab. Only renders when the board has mission tiles.
 * Lets the host set HOW missions drop (manual / interval / scheduled, random or in order) and — for
 * manual/immediate drops — announce the next one on the spot. The interval/scheduled modes fire on the
 * per-minute cron; this panel just configures + gives the manual push.
 */
export default function MissionAdminPanel({
  event,
  tiles,
  allowed = true,
}: {
  event: {
    id: number;
    rules?: string | null;
    tilesRevealed?: number | null;
    /** The run the ramp's phases are shares OF, so the editor can say what each one is in dates. */
    startDate?: string | null;
    endDate?: string | null;
  };
  tiles: Tile[];
  /** False where missions are a contradiction — a ladder's whole board is already announced pool. */
  allowed?: boolean;
}) {
  const router = useRouter();
  const rules = parseEventRules(event.rules);
  const missionTiles = tiles.filter(isMissionTile);

  const [enabled, setEnabled] = useState(rules.mission != null);
  const [mode, setMode] = useState<MissionAnnounceMode>(rules.mission?.announceMode ?? 'manual');
  const [order, setOrder] = useState<'random' | 'sequential'>(rules.mission?.order ?? 'random');
  const [intervalMinutes, setIntervalMinutes] = useState(String(rules.mission?.intervalMinutes ?? 60));
  // The difficulty curve. Empty = one pool, which is what missions did before this existed.
  const [ramp, setRamp] = useState<RampPhase[]>(rules.mission?.tierRamp ?? []);
  const [saving, setSaving] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [msg, setMsg] = useState('');

  // Renders BEFORE any mission tile exists, because this is where missions get turned on and the
  // tile editor only offers its Mission flag once they are — gating this panel on mission tiles
  // existing made the two wait on each other forever.
  if (!allowed) return null;

  const hidden = missionTiles.filter((t) => !t.revealedAt).length;
  const live = missionTiles.filter((t) => t.revealedAt && !t.closedAt).length;
  const done = missionTiles.length - hidden - live;

  async function saveConfig() {
    setSaving(true);
    setMsg('');
    try {
      const mission = enabled
        ? {
            announceMode: mode,
            order,
            intervalMinutes: Math.max(5, parseInt(intervalMinutes, 10) || 60),
            // Phases with no tiers ticked are a restriction on nothing — drop them rather than
            // storing a phase that silently means "anything".
            tierRamp: ramp.filter((p) => p.tiers.length > 0),
          }
        : null;
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: { ...rules, mission } }),
      });
      if (res.ok) {
        setMsg('Saved.');
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function announceNext() {
    setAnnouncing(true);
    setMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'announce-mission' }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Mission announced — ${Math.max(0, hidden - 1)} still hidden.`);
        router.refresh();
      } else {
        setMsg(d.error || 'Could not announce.');
      }
    } finally {
      setAnnouncing(false);
    }
  }

  return (
    <div className="min-w-0 mb-6">
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Missions
      </h2>
      <p className="text-sm text-text-muted mb-3">
        {missionTiles.length === 0 ? (
          <>
            Hidden objectives you drop mid-event, scored separately from the board.{' '}
            {enabled
              ? 'Now flag the tiles you want as missions on the Tiles tab.'
              : 'Turn them on here, then flag tiles as missions on the Tiles tab.'}
          </>
        ) : (
          <>
            Hidden objectives you drop mid-event. {missionTiles.length} mission{missionTiles.length === 1 ? '' : 's'}:{' '}
            <span className="text-gold">{hidden} hidden</span> · <span className="text-accent-green-light">{live} live</span>
            {done > 0 && <> · {done} done</>}.
          </>
        )}
      </p>

      <div className="border border-card-border rounded-xl bg-card-bg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            aria-pressed={enabled}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-gold' : 'bg-card-border'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm">Enable mission drops</span>
        </div>

        {enabled && (
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">How they drop</label>
              <Select
                value={mode}
                onChange={(v) => setMode(v as MissionAnnounceMode)}
                ariaLabel="Announce mode"
                options={[
                  { value: 'manual', label: 'Manually (button below)' },
                  { value: 'interval', label: 'On a timer' },
                  { value: 'scheduled', label: 'At set times (per mission)' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Pick order</label>
              <Select
                value={order}
                onChange={(v) => setOrder(v as 'random' | 'sequential')}
                ariaLabel="Draw order"
                options={[
                  { value: 'random', label: 'Random' },
                  { value: 'sequential', label: 'In board order' },
                ]}
              />
            </div>
            {mode === 'interval' && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Every (minutes)</label>
                <input
                  type="number"
                  min={5}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-brown-dark text-sm"
                  aria-label="Interval minutes"
                />
              </div>
            )}
            {mode === 'scheduled' && (
              <p className="sm:col-span-3 text-[11px] text-text-muted">
                Set each mission&apos;s drop time on the <span className="text-foreground">Tiles</span> tab (its Reveal time). They go live at those times.
              </p>
            )}
          </div>

        )}

        {/* The difficulty curve. Not offered in scheduled mode: per-tile times are the host
              saying exactly when each mission lands, and a curve would be second-guessing them. */}
        {enabled && mode !== 'scheduled' && (
            <div className="mt-4 border-t border-card-border pt-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-sm font-medium">Difficulty curve</p>
                {ramp.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setRamp(DEFAULT_RAMP)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
                  >
                    Ramp it up
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRamp([])}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
                  >
                    Turn off
                  </button>
                )}
              </div>
              <p className="text-[11px] text-text-muted mb-3">
                {ramp.length === 0
                  ? 'Every mission is drawn from one pool, so an Ultra can land on day one and a Troll tile in the last hour.'
                  : 'Each phase covers a share of the event, so this survives the board being cloned into different dates. If a phase runs out of missions the draw falls back to the rest rather than stopping.'}
              </p>

              {ramp.length > 0 && (
                <div className="grid gap-2">
                  {ramp.map((phase, i) => {
                    const from = i === 0 ? 0 : ramp[i - 1].throughPct;
                    const window = phaseWindow(event, from, phase.throughPct);
                    return (
                      <div key={i} className="rounded-lg border border-card-border bg-brown-dark/40 p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs text-text-muted">First</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={phase.throughPct}
                            onChange={(e) =>
                              setRamp((prev) =>
                                prev.map((p, idx) =>
                                  idx === i ? { ...p, throughPct: Number(e.target.value) || p.throughPct } : p,
                                ),
                              )
                            }
                            className="w-16 px-2 py-1 rounded border border-card-border bg-brown-dark text-sm text-right"
                            aria-label={`Phase ${i + 1} ends at percent`}
                          />
                          <span className="text-xs text-text-muted">
                            % of the event{window && <> · {shortDate(window.from)} → {shortDate(window.to)}</>}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRamp((prev) => prev.filter((_, idx) => idx !== i))}
                            className="ml-auto text-xs text-text-muted hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DEFAULT_TIER_BANDS.map((band) => {
                            const on = phase.tiers.includes(band.key);
                            return (
                              <button
                                key={band.key}
                                type="button"
                                onClick={() =>
                                  setRamp((prev) =>
                                    prev.map((p, idx) =>
                                      idx === i
                                        ? {
                                            ...p,
                                            tiers: on
                                              ? p.tiers.filter((t) => t !== band.key)
                                              : [...p.tiers, band.key],
                                          }
                                        : p,
                                    ),
                                  )
                                }
                                className={`text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${
                                  on
                                    ? 'bg-gold text-brown-dark border-gold'
                                    : 'border-card-border text-text-muted hover:text-foreground'
                                }`}
                              >
                                {band.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setRamp((prev) => [...prev, { throughPct: 100, tiers: [] }])
                    }
                    className="justify-self-start text-xs font-medium px-2.5 py-1 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
                  >
                    + Add a phase
                  </button>
                </div>
              )}
            </div>
          )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-gold/15 text-gold text-sm font-medium hover:bg-gold/25 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save mission settings'}
          </button>
          <button
            type="button"
            onClick={announceNext}
            disabled={announcing || hidden === 0 || !event.tilesRevealed}
            title={!event.tilesRevealed ? 'Arm the board first' : hidden === 0 ? 'No hidden missions left' : ''}
            className="px-3 py-2 rounded-lg bg-accent-green/15 text-accent-green-light text-sm font-medium hover:bg-accent-green/25 disabled:opacity-50"
          >
            {announcing ? 'Announcing…' : 'Announce next mission ⚡'}
          </button>
          {msg && <span className="text-xs text-text-muted">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

/** What "ramp it up" starts from: easy third, middle third, then the hard stuff. */
const DEFAULT_RAMP: RampPhase[] = [
  { throughPct: 33, tiers: ['troll', 'easy'] },
  { throughPct: 66, tiers: ['medium', 'hard'] },
  { throughPct: 100, tiers: ['ultra'] },
];

/** "Sep 4" — a phase boundary is a day, not a timestamp. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
