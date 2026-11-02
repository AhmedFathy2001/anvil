import { countProgress, memberProgress, submissionCreditKey, type CountedSubmission } from '@/lib/countProgress';
import { collectionProgress } from '@/lib/pluginPanel';
import { isMilestoneBasis } from '@/lib/statTracking';
import { parseCapBy } from '@/lib/tileCaps';
import { parseJsonArray } from '@/lib/tileKinds';
import { clogTileMode } from '@/lib/clogTileWords';
import {
  comboNeeded,
  evaluateCombo,
  evaluateMix,
  mixPercent,
  parseComboRule,
  partFraction,
  type ComboRule,
  type PartState,
} from '@/lib/combo';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// How far along each PART of a combo is (lib/combo), from the rows every surface already has: the
// part's submissions, its stat gains, its completion. A 'mix' combo is scored from these fractions;
// every combo DISPLAYS them ("1 of 2 · 37/100 searches", "75% — 1/2 zenytes, 100/200 kills").
//
// Each part keeps its own engine's notion of progress — a count tile's (capped) count, a collection's
// pieces, a stat tile's gain — and kinds with no partial progress (a timed clear, a single-haul value
// tile, a manual tile, a milestone) are simply done or not.
//
// Pure — the completion writer (lib/comboCompletion) and the board share it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The part fields progress reads (a full tile row is fine). */
export interface ProgressPart {
  id: number;
  label?: string;
  tileType?: string | null;
  requiredAmount?: number | null;
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  statBasis?: string | null;
  itemRequirements?: string | null;
  groupMode?: string | null;
  setsRequired?: number | null;
  countMode?: string | null;
  timedActivity?: string | null;
  capBy?: string | null;
  comboWeight?: number | null;
}

export interface PartRow extends CountedSubmission {
  itemId?: number | null;
}

/** One part's inputs for ONE team. */
export interface PartInputs {
  /** The team finished it (a completions row). */
  done: boolean;
  /** Who it credits, when the completion names one (a Solo part's finisher). */
  doneBy?: number | null;
  /** The part's submissions for the team (cap rows included). */
  subs?: PartRow[];
  /** Stat part: each team member's gain (and lifetime, for a milestone). */
  stat?: { playerId: number; gained: number }[];
}

/** Count kinds whose `requiredAmount` is a count the submissions add up to. */
const COUNT_KINDS = new Set(['drop', 'kill', 'lap', 'pvp', 'gain', 'deathless', 'diary', 'ca', 'lms', 'valuetotal']);

function isTrialRuns(p: ProgressPart): boolean {
  return p.tileType === 'timed' && (p.requiredAmount ?? 1) > 1;
}

/**
 * A part's state for the team (`playerId` undefined) or one member. Done parts are done; a part the
 * team finished without a named finisher is done for every member too.
 */
export function partState(part: ProgressPart, inputs: PartInputs, playerId?: number): PartState {
  if (inputs.done && (playerId === undefined || inputs.doneBy == null || inputs.doneBy === playerId)) return { done: true };
  const subs = inputs.subs ?? [];
  if (part.trackedStat && part.statGoal) {
    if (isMilestoneBasis(part.statBasis)) return { done: false };
    const rows = inputs.stat ?? [];
    const gained = playerId === undefined
      ? rows.reduce((s, r) => s + Math.max(0, r.gained), 0)
      : Math.max(0, rows.find((r) => r.playerId === playerId)?.gained ?? 0);
    return { done: false, current: gained, required: part.statGoal };
  }
  const reqs = parseJsonArray<{ itemId: number; requiredAmount: number; group?: string | null; groupRequire?: number | null }>(part.itemRequirements);
  if (reqs.length > 0) {
    const totals = new Map<number, number>();
    for (const s of subs) {
      if (s.goal != null || s.itemId == null) continue;
      if (playerId !== undefined && submissionCreditKey(s) !== playerId) continue;
      totals.set(s.itemId, (totals.get(s.itemId) ?? 0) + s.amount);
    }
    const [current, goal] = collectionProgress(
      reqs.map((r) => ({ ...r, currentAmount: totals.get(r.itemId) ?? 0 })),
      part.groupMode,
      part.setsRequired ?? 1,
    );
    return { done: false, current, required: goal };
  }
  // A collection-log part (lib/clogTiles): new slots are distinct (member, item) credits, counted
  // like the tile counts them; whole pages are read off each member's log — done or not here.
  if (part.tileType === 'clog') {
    if (clogTileMode(part.countMode) === 'complete') return { done: false };
    const required = Math.max(1, part.requiredAmount ?? 1);
    const current = playerId === undefined ? countProgress(subs, 'team', 'slots').current : memberProgress(subs, playerId, 'slots');
    return { done: false, current, required };
  }
  if ((part.tileType && COUNT_KINDS.has(part.tileType)) || isTrialRuns(part)) {
    const required = Math.max(1, part.requiredAmount ?? 1);
    const caps = parseCapBy(part.capBy);
    const countMode = part.countMode === 'distinct' ? 'distinct' : null;
    const current = playerId === undefined
      ? countProgress(subs, 'team', countMode, caps).current
      : memberProgress(subs, playerId, countMode, caps);
    return { done: false, current, required };
  }
  // A timed clear, a single-haul value tile, a manual tile: done or not.
  return { done: false };
}

export interface ComboView {
  rule: ComboRule;
  complete: boolean;
  /** Parts done (any/all/nOf), or the share ×100 rounded down (mix). */
  done: number;
  /** Parts needed (any/all/nOf), or 100 (mix). */
  needed: number;
  /** Mix: the combined share, 1 = 100%. */
  share: number | null;
  finisherPlayerId: number | null;
  parts: { id: number; label: string; state: PartState; fraction: number; weight: number }[];
  /** "1 of 2 done" / "75%". */
  summary: string;
}

/**
 * Everything the board shows for one combo and one team: whether it's complete under its rule, how far
 * along, and each part's own progress. `trackingMode` is the combo's (Solo = one member does it all).
 */
export function comboView(
  combo: { comboRule?: string | null; trackingMode?: string | null },
  parts: readonly ProgressPart[],
  inputsOf: (partId: number) => PartInputs,
  memberIds: readonly number[] = [],
): ComboView {
  const rule = parseComboRule(combo.comboRule);
  const teamState = new Map(parts.map((p) => [p.id, partState(p, inputsOf(p.id))]));
  const partRows = parts.map((p) => {
    const state = teamState.get(p.id)!;
    return { id: p.id, label: p.label ?? '', state, fraction: partFraction(state), weight: p.comboWeight != null && p.comboWeight > 0 ? p.comboWeight : 1 };
  });
  if (rule.mode === 'mix') {
    const members = new Map(
      memberIds.map((m) => {
        const own = new Map(parts.map((p) => [p.id, partState(p, inputsOf(p.id), m)]));
        return [m, (id: number) => own.get(id)] as const;
      }),
    );
    const ev = evaluateMix(parts, (id) => teamState.get(id), combo.trackingMode, members);
    return {
      rule,
      complete: ev.complete,
      done: Math.min(100, Math.floor(ev.share * 100 + 1e-7)),
      needed: 100,
      share: ev.share,
      finisherPlayerId: ev.finisherPlayerId,
      parts: partRows,
      summary: mixPercent(ev.share),
    };
  }
  const completions = parts
    .map((p) => ({ p, i: inputsOf(p.id) }))
    .filter(({ i }) => i.done)
    .map(({ p, i }) => ({ tileId: p.id, creditPlayerId: i.doneBy ?? null }));
  const ev = evaluateCombo(rule, parts.map((p) => p.id), completions, combo.trackingMode);
  return {
    rule,
    complete: ev.complete,
    done: ev.done,
    needed: comboNeeded(rule, parts.length),
    share: null,
    finisherPlayerId: ev.finisherPlayerId,
    parts: partRows,
    summary: `${Math.min(ev.done, ev.needed)} of ${ev.needed} done`,
  };
}

/** A part's own progress, short: "37/100", "done", or "" when it has no partial progress. */
export function partProgressText(state: PartState): string {
  if (state.done) return 'done';
  if (state.current == null || state.required == null) return '';
  return `${Math.min(state.current, state.required).toLocaleString('en-US')}/${state.required.toLocaleString('en-US')}`;
}

/** "75% — 1/2 Zenyte shards, 100/200 Demonic gorilla kills" / "1 of 2 done — 37/100 searches". */
export function comboProgressLine(view: ComboView): string {
  const open = view.parts
    .filter((p) => !p.state.done)
    .map((p) => {
      const t = partProgressText(p.state);
      return t ? `${t} ${p.label}` : p.label;
    });
  return open.length ? `${view.summary} — ${open.join(', ')}` : view.summary;
}
