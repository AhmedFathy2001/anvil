'use client';

import { useMemo, useState } from 'react';
import Select from '@/components/Select';
import Checkbox from '@/components/Checkbox';
import { useDialog } from '@/components/Confirm';
import RaceRouteMap from '@/components/board/RaceRouteMap';
import { clanFetch } from '@/lib/clanFetch';
import {
  ROUTE_TEMPLATES,
  applyRouteTemplate,
  insertStep,
  isBranchingRoute,
  moveTileToStep,
  removeStep,
  routeEntries,
  swapSteps,
  toggleRouteLink,
  validateRoute,
  type RouteEntry,
  type RouteTemplate,
} from '@/lib/raceRoutes';
import type { Tile } from '@/lib/types';

interface Props {
  eventId: number;
  tiles: Tile[];
  eventStarted: boolean;
  raceBank: boolean;
  raceRoad: 'achieve' | 'choose';
  /** A tile was created straight into a step (already saved as a blank tile). */
  onTileCreated: (tile: Tile) => void;
  /** The route was saved: each tile's new step / links / position. */
  onSaved: (update: Map<number, { raceStep: number | null; raceNext: number[] | null; position?: number }>) => void;
  onRaceBankChanged: (on: boolean) => void;
  onOpenTile: (id: number) => void;
}

const btn = 'text-xs font-medium px-2.5 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const goldBtn = 'text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * The Route view of a tile race's tile admin (lib/raceRoutes). Click a tile, then click tiles on the
 * step before or after it to link or unlink them — a tile with several links in and out is a
 * junction where lanes swap. Steps can be added, removed and reordered; a tile can move to another
 * step or be added straight into one. Templates fill steps and links for the current tiles (their
 * content is untouched). Nothing is stored until Save, and Save refuses a route that can't be played.
 */
export default function RaceRouteEditor({ eventId, tiles, eventStarted, raceBank, raceRoad, onTileCreated, onSaved, onRaceBankChanged, onOpenTile }: Props) {
  const { confirm, notify } = useDialog();
  const board = useMemo(() => tiles.filter((t) => t.parentTileId == null && !t.mission).sort((a, b) => a.position - b.position), [tiles]);
  const stored = useMemo(() => routeEntries(board), [board]);
  const [entries, setEntries] = useState<RouteEntry[]>(stored);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [template, setTemplate] = useState<RouteTemplate>('lanes2');
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [bank, setBank] = useState(raceBank);
  const [road, setRoad] = useState(raceRoad);
  const branching = isBranchingRoute(board);

  // Tiles added elsewhere (Cards, Quick build) join the editor as unplaced.
  const known = new Set(entries.map((e) => e.id));
  const missing = board.filter((t) => !known.has(t.id));
  const gone = entries.filter((e) => !board.some((t) => t.id === e.id)).map((e) => e.id);
  const live: RouteEntry[] =
    missing.length || gone.length
      ? [...entries.filter((e) => !gone.includes(e.id)).map((e) => ({ ...e, next: e.next.filter((n) => !gone.includes(n)) })), ...missing.map((t) => ({ id: t.id, step: null, next: [] }))]
      : entries;

  const labelOf = (id: number) => `“${board.find((t) => t.id === id)?.label ?? `Tile ${id}`}”`;
  const problems = validateRoute(live, labelOf);
  const problemIds = new Set(problems.map((p) => p.tileId).filter((id): id is number => id != null));
  const placed = live.filter((e) => e.step != null);
  const unplaced = live.filter((e) => e.step == null);
  const lastStep = placed.reduce((m, e) => Math.max(m, e.step!), -1);
  const stepCount = lastStep + 1;
  const sel = live.find((e) => e.id === selected) ?? null;
  const linkable = new Set(
    sel?.step != null ? placed.filter((e) => e.step === sel.step! + 1 || e.step === sel.step! - 1).map((e) => e.id) : [],
  );

  function change(next: RouteEntry[], dropped = 0, what = '') {
    setEntries(next);
    setDirty(true);
    setWarning(dropped > 0 ? `${what} dropped ${dropped} link${dropped === 1 ? '' : 's'} that no longer ran to the next step.` : null);
  }

  function clickTile(id: number) {
    if (eventStarted) return onOpenTile(id);
    if (selected == null || selected === id) return setSelected(selected === id ? null : id);
    if (linkable.has(id)) return change(toggleRouteLink(live, selected, id));
    setSelected(id);
  }

  async function applyTemplate() {
    const meta = ROUTE_TEMPLATES.find((t) => t.key === template)!;
    if (placed.some((e) => e.next.length) && !(await confirm({ title: `Lay out as “${meta.label}”?`, body: 'This replaces every step and link. Tile content stays as it is.', confirmLabel: 'Replace route' }))) return;
    change(applyRouteTemplate(template, board.map((t) => t.id)));
    setSelected(null);
  }

  async function makeStraight() {
    if (!(await confirm({ title: 'Make it a straight line?', body: 'Every tile leads to the next one in board order — the classic tile race. Steps and links are cleared.', confirmLabel: 'Straight line' }))) return;
    setSaving(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/race-route`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ straight: true }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify(data.error || 'Could not save the route.', 'error');
      const update = new Map(board.map((t) => [t.id, { raceStep: null, raceNext: null }]));
      onSaved(update);
      setEntries(routeEntries(board.map((t) => ({ ...t, raceStep: null, raceNext: null }))));
      setDirty(false);
      setWarning(null);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (problems.length) return;
    setSaving(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/race-route`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: live.map((e) => ({ id: e.id, step: e.step, next: e.next })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify(data.error || 'Could not save the route.', 'error');
      const order: number[] = data.order ?? [];
      const update = new Map(live.map((e) => [e.id, { raceStep: e.step, raceNext: e.next, position: order.indexOf(e.id) }]));
      onSaved(update);
      setDirty(false);
      setWarning(null);
    } finally {
      setSaving(false);
    }
  }

  async function addTileToStep(step: number) {
    const res = await clanFetch(`/api/events/${eventId}/tiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return notify(data.error || 'Could not add a tile.', 'error');
    onTileCreated(data as Tile);
    change([...live, { id: data.id, step, next: [] }]);
    setSelected(data.id);
  }

  async function changeRoad(next: 'achieve' | 'choose') {
    const prev = road;
    setRoad(next);
    const res = await clanFetch(`/api/events/${eventId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { raceRoad: next } }) });
    if (!res.ok) {
      setRoad(prev);
      const data = await res.json().catch(() => ({}));
      return notify(data.error || 'Could not save that setting.', 'error');
    }
    onRaceBankChanged(bank);
  }

  async function toggleBank(on: boolean) {
    setBank(on);
    const res = await clanFetch(`/api/events/${eventId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { raceBank: on } }) });
    if (!res.ok) {
      setBank(!on);
      const data = await res.json().catch(() => ({}));
      return notify(data.error || 'Could not save that setting.', 'error');
    }
    onRaceBankChanged(on);
  }

  const stepOptions = Array.from({ length: stepCount + 1 }, (_, s) => ({ value: String(s), label: s === stepCount ? `New step ${s + 1} (at the end)` : `Step ${s + 1}${s === 0 ? ' · start' : s === lastStep ? ' · finish' : ''}` }));
  const nodes = placed.map((e) => ({ id: e.id, step: e.step!, next: e.next, label: board.find((t) => t.id === e.id)?.label ?? `Tile ${e.id}`, icon: board.find((t) => t.id === e.id)?.icon ?? null }));

  return (
    <div className="space-y-4 min-w-0">
      <div className="border border-card-border rounded-xl bg-card-bg p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full" />Route</h3>
            <p className="text-xs text-text-muted mt-1 max-w-2xl">
              {branching || dirty
                ? 'Tiles sit on numbered steps; each links to tiles on the next step. A team’s road is set at each fork (see “At a fork”), and the other options at that step close for it. Every route has the same number of steps, so the team with the most steps done is closest to the end.'
                : 'This race is a straight line: every tile leads to the next. Pick a template or click a tile and link it to lay out branching routes.'}
            </p>
          </div>
          {!eventStarted && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44"><Select value={template} onChange={(v) => setTemplate(v as RouteTemplate)} options={ROUTE_TEMPLATES.map((t) => ({ value: t.key, label: t.label }))} ariaLabel="Route template" /></div>
              <button type="button" className={btn} onClick={applyTemplate} title={ROUTE_TEMPLATES.find((t) => t.key === template)?.help}>Apply template</button>
              <button type="button" className={btn} onClick={makeStraight} disabled={saving}>Make it a straight line</button>
            </div>
          )}
        </div>
        {!eventStarted && <p className="text-[11px] text-text-muted">{ROUTE_TEMPLATES.find((t) => t.key === template)?.help} Templates set steps and links only.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">At a fork</span>
          <div className="w-60">
            <Select
              value={road}
              onChange={(v) => void changeRoad(v as 'achieve' | 'choose')}
              disabled={eventStarted}
              ariaLabel="How a team's road is set at a fork"
              options={[
                { value: 'achieve', label: 'By achievement' },
                { value: 'choose', label: 'Choose and lock in' },
              ]}
            />
          </div>
          <p className="text-[11px] text-text-muted basis-full">
            {road === 'achieve'
              ? 'Every linked next tile is open; whichever the team finishes first sets its road and the others close.'
              : 'The team’s captain (or team staff; any member if the team has neither) picks the next tile before it counts. Only the pick is open and it can’t be changed — an admin can reset it.'}
          </p>
        </div>
        <Checkbox
          checked={bank}
          onChange={(on) => void toggleBank(on)}
          disabled={eventStarted}
          label="Bank early finishes"
          description="Off: only tiles open on a team's route count. On: a valid finish on a tile the team hasn't reached yet is kept, and the tile completes the moment their route reaches it — it never skips ahead or opens anything early."
        />
      </div>

      {eventStarted && <p className="text-xs text-text-muted">The route is locked once the race starts. Click a tile to open it.</p>}
      {!eventStarted && (
        <p className="text-xs text-text-muted">
          {sel
            ? <>Linking from <span className="text-gold">{labelOf(sel.id)}</span>: click a dashed tile on the step before or after to link it, a linked one to unlink. Click the tile again to let go.</>
            : 'Click a tile to select it, then click tiles on the next (or previous) step to link them. Several links in and out make a junction where teams can switch lanes.'}
        </p>
      )}

      <RaceRouteMap nodes={nodes} onTileClick={clickTile} selectedId={selected} linkable={linkable} problemIds={problemIds} />

      {!eventStarted && sel && (
        <div className="border border-gold/30 rounded-xl bg-card-bg p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-foreground font-medium truncate max-w-[14rem]">{labelOf(sel.id)}</span>
          <span className="text-xs text-text-muted">on</span>
          <div className="w-56">
            <Select
              value={sel.step == null ? '' : String(sel.step)}
              placeholder="Place on a step…"
              onChange={(v) => {
                const r = moveTileToStep(live, sel.id, Number(v));
                change(r.entries, r.dropped, 'Moving it');
              }}
              options={stepOptions}
              ariaLabel="Step for this tile"
            />
          </div>
          <button type="button" className={btn} onClick={() => onOpenTile(sel.id)}>Edit tile…</button>
          <button type="button" className={btn} onClick={() => setSelected(null)}>Done</button>
        </div>
      )}

      {!eventStarted && unplaced.length > 0 && (
        <div className="border border-card-border rounded-xl bg-card-bg p-3">
          <p className="text-xs text-text-muted mb-2">Not on the route yet — click one, then pick its step:</p>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map((e) => (
              <button key={e.id} type="button" onClick={() => setSelected(e.id)} className={`text-xs px-2 py-1 rounded-md border ${selected === e.id ? 'border-gold text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`}>
                {board.find((t) => t.id === e.id)?.label ?? `Tile ${e.id}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {!eventStarted && stepCount > 0 && (
        <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
          {Array.from({ length: stepCount }, (_, s) => {
            const n = placed.filter((e) => e.step === s).length;
            return (
              <div key={s} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="text-xs font-semibold text-foreground w-24 shrink-0">Step {s + 1}{s === 0 ? ' · start' : s === lastStep ? ' · finish' : ''}</span>
                <span className="text-[11px] text-text-muted w-14 shrink-0">{n} tile{n === 1 ? '' : 's'}</span>
                <div className="flex flex-wrap gap-1.5 ml-auto">
                  <button type="button" className={btn} disabled={s === 0} onClick={() => { const r = swapSteps(live, s, -1); change(r.entries, r.dropped, 'Moving the step'); }} aria-label={`Move step ${s + 1} earlier`}>◀</button>
                  <button type="button" className={btn} disabled={s === lastStep} onClick={() => { const r = swapSteps(live, s, 1); change(r.entries, r.dropped, 'Moving the step'); }} aria-label={`Move step ${s + 1} later`}>▶</button>
                  <button type="button" className={btn} onClick={() => { const before = live; const next = insertStep(live, s); const lost = before.reduce((a, e) => a + e.next.length, 0) - next.reduce((a, e) => a + e.next.length, 0); change(next, lost, 'Adding the step'); }}>+ Step before</button>
                  <button type="button" className={btn} onClick={() => void addTileToStep(s)}>+ Tile here</button>
                  <button type="button" className={btn} onClick={() => { const r = removeStep(live, s); change(r.entries, r.dropped, 'Removing the step'); }}>Remove step</button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="text-xs text-text-muted">After the finish:</span>
            <button type="button" className={btn} onClick={() => void addTileToStep(stepCount)}>+ Tile on a new last step</button>
          </div>
        </div>
      )}

      {warning && <p className="text-xs text-amber-400">{warning}</p>}

      {!eventStarted && (
        <div className="border border-card-border rounded-xl bg-card-bg p-3 space-y-2">
          {problems.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-red-400">Fix {problems.length === 1 ? 'this' : `these ${problems.length}`} before saving:</p>
              <ul className="space-y-1">
                {problems.slice(0, 12).map((p, i) => (
                  <li key={i} className="text-xs text-text-muted">
                    {p.tileId != null ? (
                      <button type="button" className="text-left hover:text-foreground" onClick={() => setSelected(p.tileId)}>• {p.message}</button>
                    ) : (
                      <>• {p.message}</>
                    )}
                  </li>
                ))}
                {problems.length > 12 && <li className="text-xs text-text-muted">…and {problems.length - 12} more.</li>}
              </ul>
            </>
          ) : (
            <p className="text-xs text-green-400">The route is playable: {stepCount} step{stepCount === 1 ? '' : 's'}, {placed.filter((e) => e.step === 0).length} start{placed.filter((e) => e.step === 0).length === 1 ? '' : 's'}, {placed.filter((e) => e.step === lastStep).length} finish{placed.filter((e) => e.step === lastStep).length === 1 ? '' : 'es'}.</p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" className={goldBtn} onClick={save} disabled={saving || problems.length > 0 || (!dirty && !missing.length && !gone.length)}>
              {saving ? 'Saving…' : 'Save route'}
            </button>
            {dirty && (
              <button type="button" className={btn} onClick={() => { setEntries(stored); setDirty(false); setWarning(null); setSelected(null); }}>Discard changes</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
