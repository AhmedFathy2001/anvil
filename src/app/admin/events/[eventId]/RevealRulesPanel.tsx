'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/Select';
import NumberInput from '@/components/NumberInput';
import { parseEventRules, nextRevealAt, type RevealPolicy, type RevealOrder } from '@/lib/eventRules';
import { eventAxes, supportsRevealPolicy } from '@/lib/eventAxes';
import { eventModeLabel } from '@/lib/utils';
import type { Event, Tile } from '@/lib/types';

/**
 * How tiles OPEN on a reveal-policy event, editable after the event exists.
 *
 * These settings used to be create-time only: pick "Ladder" or "Lucky draw" in the wizard and the
 * interval, window and draw order were frozen for the life of the event — there was no screen that
 * would even TELL you what the rotation was, let alone change it. This panel is that screen.
 *
 * Everything here is safe to change mid-event: the engine recomputes what's due from the event's
 * start each tick (lib/revealEngine), so a new interval takes effect from the next minute without
 * re-revealing anything already live.
 *
 * The reveal POLICY itself is only switchable on a ladder, where progressive / rotating window /
 * one-at-a-time is a sub-choice of the same format. On a bingo the policy IS the mode (Showdown,
 * Lucky draw, Bounty hunt), so switching it means Change Type — which rebuilds the board.
 */
export default function RevealRulesPanel({ event, tiles }: { event: Event; tiles: Tile[] }) {
  const router = useRouter();
  const stored = parseEventRules(event.rules);
  const axes = eventAxes(event);
  // Individual boards call them tasks and use "rotation"; team boards call them tiles.
  const isLadder = axes.competitors === 'individuals';
  const pointsMode = axes.scoring === 'points';

  const [policy, setPolicy] = useState<RevealPolicy>(stored.revealPolicy);
  const [intervalMinutes, setIntervalMinutes] = useState(stored.revealIntervalMinutes);
  const [batchSize, setBatchSize] = useState(stored.revealBatchSize);
  const [windowSize, setWindowSize] = useState(stored.revealWindowSize);
  const [order, setOrder] = useState<RevealOrder>(stored.revealOrder);
  const [firstBonus, setFirstBonus] = useState(stored.firstBonus);
  const [decayEnabled, setDecayEnabled] = useState(stored.decay != null);
  const [decayMode, setDecayMode] = useState<'decay' | 'grow'>(
    stored.decay && stored.decay.targetPct > 100 ? 'grow' : 'decay',
  );
  const [decayTargetPct, setDecayTargetPct] = useState(stored.decay?.targetPct ?? 50);
  const [decayHours, setDecayHours] = useState(stored.decay?.hours ?? 24);
  const [lockout, setLockout] = useState(stored.lockout);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [opening, setOpening] = useState(false);

  // Who gets this panel. Anything already ON a reveal policy, plus any points-scored board that
  // COULD take one — a ladder whose rules are still NULL (cloned, templated, or made before the
  // rotation existed) has no other way to get an interval, which is the bug that motivated this.
  // Tiles-scored classic bingo is left out: reveal policies only ever shipped on points boards.
  const canConfigure = stored.revealPolicy !== 'all' || supportsRevealPolicy(axes);
  if (!canConfigure) return null;
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();

  const live = tiles.filter((t) => t.revealedAt && !t.closedAt).length;
  const hidden = tiles.filter((t) => !t.revealedAt).length;
  const closed = tiles.filter((t) => t.closedAt).length;
  const nextDraw = nextRevealAt(
    { startDate: event.startDate ?? null, rules: event.rules ?? null },
    { ...stored, revealPolicy: policy, revealIntervalMinutes: intervalMinutes },
    tiles,
  );

  /**
   * Open the next `count` hidden tiles right now.
   *
   * Draw order decides which ones: sequential takes them in board order, random shuffles — the same
   * choice the engine would have made, just without waiting for the clock.
   */
  async function openNow(count: number) {
    const pool = tiles.filter((t) => !t.revealedAt);
    if (pool.length === 0) return;
    const picked =
      order === 'random'
        ? [...pool].sort(() => Math.random() - 0.5).slice(0, count)
        : [...pool].sort((a, b) => a.position - b.position).slice(0, count);
    if (
      picked.length > 1 &&
      !confirm(`Open ${picked.length} ${isLadder ? 'tasks' : 'tiles'} now? Members can start scoring them immediately.`)
    ) {
      return;
    }
    setOpening(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${event.id}/tiles/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileIds: picked.map((t) => t.id), set: { revealState: 'live' } }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ type: 'success', text: `Opened ${data.updated ?? picked.length}.` });
        router.refresh();
      } else {
        setMsg({ type: 'error', text: data.error ?? 'That did not open.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'That did not open.' });
    } finally {
      setOpening(false);
    }
  }

  async function save() {
    // Turning a rotation ON mid-event pulls every not-yet-drawn tile off the members' board (a
    // classic board's tiles carry no revealedAt, so the engine treats them all as still hidden).
    // Before start that's just setup; after start it's a visible change, so say so first.
    if (eventStarted && stored.revealPolicy === 'all' && policy !== 'all') {
      const stillHidden = tiles.filter((t) => !t.revealedAt).length;
      if (!confirm(
        `Switch this running board to a rotation? ${stillHidden} tile${stillHidden === 1 ? '' : 's'} that ` +
        'members can see now will drop out of view until the engine draws them. Completions already ' +
        'earned are untouched.',
      )) return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Spread the stored rules so the keys this panel doesn't own (mission announce config,
        // balanceMode) survive — the API replaces the whole rules blob.
        body: JSON.stringify({
          rules: {
            ...stored,
            revealPolicy: policy,
            revealIntervalMinutes: intervalMinutes,
            revealBatchSize: batchSize,
            revealWindowSize: windowSize,
            revealOrder: order,
            firstBonus,
            decay: decayEnabled ? { targetPct: decayTargetPct, hours: decayHours } : null,
            lockout,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Could not save these settings.' });
        return;
      }
      setMsg({ type: 'success', text: 'Saved — the engine picks this up on its next pass (within a minute).' });
      router.refresh();
    } catch {
      setMsg({ type: 'error', text: 'Could not save these settings.' });
    } finally {
      setSaving(false);
    }
  }

  const policyBlurb: Record<RevealPolicy, string> = {
    all: 'Every tile is visible as soon as you reveal the board.',
    scheduled: 'Each tile opens at the time you set for it on the Tiles tab.',
    interval: 'Hidden tasks open on the timer below and stay open for the rest of the event.',
    rotating: 'A rolling window of open tasks — each draw opens new ones and expires the oldest.',
    bounty: 'One task open at a time — the first to finish it claims it and the next is drawn.',
  };

  return (
    <div className="min-w-0">
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Reveal &amp; rotation
      </h2>
      <p className="text-sm text-text-muted mb-3">
        How and when tasks open on this board. Safe to change mid-event — nothing already live is
        taken away.
      </p>

      {/* The named modes are presets over these axes, not separate systems — so the label is shown
          as a consequence of the settings rather than a type the event is stuck with. Change how
          tasks open and the name changes with it. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-gold/30 bg-gold/10 text-gold px-2 py-0.5 font-medium">
          {eventModeLabel(event.format, event.scoringMode, JSON.stringify({ ...stored, revealPolicy: policy }))}
        </span>
        <span className="text-text-muted">
          {axes.competitors === 'individuals' ? 'ranks players' : 'ranks teams'}
          {' · '}
          {axes.scoring === 'points' ? 'points' : 'tile count'}
          {' · '}
          {axes.runLength === 'rolling' ? 'no end date' : 'runs to a finish'}
        </span>
      </div>

      <div className="border border-card-border rounded-xl bg-card-bg p-4 space-y-4">
        {/* Only meaningful once tiles actually open in stages — on an "all at once" board every
            tile is simply visible, and an "N hidden" chip would be a lie. */}
        {stored.revealPolicy !== 'all' && (
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="rounded-full border border-accent-green/30 bg-accent-green/10 text-accent-green-light px-2.5 py-1">
            {live} open
          </span>
          <span className="rounded-full border border-gold/30 bg-gold/10 text-gold px-2.5 py-1">{hidden} hidden</span>
          {closed > 0 && (
            <span className="rounded-full border border-card-border text-text-muted px-2.5 py-1">{closed} closed</span>
          )}
          {nextDraw && hidden > 0 && (
            <span className="text-text-muted" suppressHydrationWarning>
              Next draw {new Date(nextDraw).toLocaleString()}
            </span>
          )}
          {!event.startDate && (
            <span className="text-gold">Nothing opens until the event starts.</span>
          )}
        </div>
        )}

        <div>
          <label className="block text-xs text-text-muted mb-1">
            {isLadder ? 'Task rotation' : 'How tiles open'}
          </label>
          <Select
            value={policy}
            onChange={(v) => setPolicy(v as RevealPolicy)}
            ariaLabel={isLadder ? 'Task rotation' : 'How tiles open'}
            options={[
              { value: 'all', label: 'All at once — every tile is open from the start' },
              { value: 'interval', label: 'Progressive — new tiles open on a timer and stay open' },
              { value: 'rotating', label: 'Rotating window — a few open at once; new draws expire the oldest' },
              { value: 'bounty', label: 'One at a time — first to finish claims it, next is drawn' },
              { value: 'scheduled', label: 'Scheduled — each tile opens at a time you set on the Tiles tab' },
            ]}
          />
          <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
            {policyBlurb[policy]}
            {!isLadder && (
              <>
                {' '}This is the same knob the Showdown / Lucky draw / Bounty presets set — changing it here
                keeps your tiles exactly as they are, unlike Change Type.
              </>
            )}
          </p>
        </div>

        {policy === 'scheduled' && (
          <p className="text-xs text-text-muted leading-relaxed rounded-lg border border-card-border bg-brown-dark/30 px-3 py-2">
            This one is per-tile: each task opens at the time set on its own editor, and a task with no time
            stays hidden until you give it one — or until you open it from here. Every other option above
            drives the whole board, which is usually what you want.
          </p>
        )}

        {(policy === 'interval' || policy === 'rotating') && (
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Minutes between draws</label>
              <NumberInput
                value={intervalMinutes}
                onChange={setIntervalMinutes}
                min={5}
                max={10080}
                fallback={60}
                className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Tasks per draw</label>
              <NumberInput
                value={batchSize}
                onChange={setBatchSize}
                min={1}
                max={50}
                fallback={1}
                className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            {policy === 'rotating' && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Open at once (window)</label>
                <NumberInput
                  value={windowSize}
                  onChange={setWindowSize}
                  min={1}
                  max={50}
                  fallback={3}
                  className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
                />
              </div>
            )}
          </div>
        )}

        {(policy === 'interval' || policy === 'rotating' || policy === 'bounty') && (
          <div>
            <label className="block text-xs text-text-muted mb-1">Draw order</label>
            <Select
              value={order}
              onChange={(v) => setOrder(v as RevealOrder)}
              ariaLabel="Draw order"
              options={[
                { value: 'random', label: 'Random — any hidden task can be next' },
                { value: 'sequential', label: 'Board order — tasks open in position order' },
              ]}
            />
          </div>
        )}

        {pointsMode && (
          <div className="border-t border-card-border pt-4 space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">First-finisher bonus points</label>
              <div className="flex items-center gap-2 flex-wrap">
                <NumberInput
                  value={firstBonus}
                  onChange={setFirstBonus}
                  min={0}
                  max={100000}
                  fallback={0}
                  className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
                />
                <span className="text-xs text-text-muted">
                  {firstBonus > 0 ? `+${firstBonus} for finishing a task first.` : '0 = no bonus.'}
                </span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={decayEnabled}
                  onChange={(e) => setDecayEnabled(e.target.checked)}
                  className="w-4 h-4 accent-gold"
                />
                Points change the longer a task has been open
              </label>
              {decayEnabled && (
                <div className="grid sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Direction</label>
                    <Select
                      value={decayMode}
                      onChange={(v) => {
                        const m = v as 'decay' | 'grow';
                        setDecayMode(m);
                        setDecayTargetPct(m === 'grow' ? Math.max(101, decayTargetPct) : Math.min(99, decayTargetPct));
                      }}
                      ariaLabel="Direction"
                      options={[
                        { value: 'decay', label: 'Decay — worth less over time' },
                        { value: 'grow', label: 'Grow — worth more over time' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">
                      {decayMode === 'grow' ? 'Cap (% of points)' : 'Floor (% of points)'}
                    </label>
                    <NumberInput
                      value={decayTargetPct}
                      onChange={setDecayTargetPct}
                      min={decayMode === 'grow' ? 101 : 0}
                      max={decayMode === 'grow' ? 1000 : 100}
                      fallback={decayMode === 'grow' ? 150 : 50}
                      className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Over (hours)</label>
                    <NumberInput
                      value={decayHours}
                      onChange={setDecayHours}
                      min={1}
                      max={720}
                      fallback={24}
                      className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
                    />
                  </div>
                  <p className="sm:col-span-3 text-[11px] text-text-muted leading-relaxed">
                    A task is worth full points when it opens and {decayTargetPct}% after {decayHours}h, then holds
                    {decayMode === 'decay' && decayTargetPct === 0 ? ' at nothing' : ''}. Already-earned points never
                    change — the value is frozen when someone completes it.
                  </p>
                </div>
              )}
            </div>

            {policy !== 'bounty' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lockout}
                  onChange={(e) => setLockout(e.target.checked)}
                  className="w-4 h-4 accent-gold"
                />
                First finisher locks the task for everyone else
              </label>
            )}
          </div>
        )}

        {/* Open things by hand. The policy above decides what opens on its own; this is for the
            night you want the next one NOW — or all of them, because something's gone wrong and the
            schedule is no longer the plan. Only on a started board: nothing opens before that. */}
        {eventStarted && hidden > 0 && (
          <div className="rounded-lg border border-card-border bg-brown-dark/30 px-3 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-muted flex-1 min-w-[12rem]">
                {hidden} {isLadder ? 'task' : 'tile'}
                {hidden === 1 ? '' : 's'} still hidden.
              </span>
              <button
                onClick={() => openNow(Math.max(1, batchSize))}
                disabled={opening}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
              >
                Open next {Math.max(1, batchSize)} now
              </button>
              <button
                onClick={() => openNow(hidden)}
                disabled={opening}
                className="text-xs px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                Open everything
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap border-t border-card-border pt-3">
          <button
            onClick={save}
            disabled={saving}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save reveal settings'}
          </button>
          {msg && (
            <span className={`text-xs ${msg.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
