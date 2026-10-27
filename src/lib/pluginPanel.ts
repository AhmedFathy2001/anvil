// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The plugin side panel's rows, worked out here so the plugin only draws them (capability
// 'panel-view'). Everything in it is a reshaping of data /api/plugin/config already sends: the tile
// rows, "Active now", and the schedule in the order the panel shows it. It used to be built in the
// plugin, which costs plugin-hub review tokens and drew "Active now" without the caller in it — the
// plugin was meant to add itself from a local signal that rarely fired.
//
// Pure and dependency-free (tests/plugin-panel.test.ts) apart from the types.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import type { ScheduleBingo, ScheduleWeekly, PluginSchedule } from '@/lib/pluginConfig';

/** One tile row: what the panel draws for it. `current`/`goal` are in the unit the bar fills in. */
export interface PanelTile {
  tileId: number;
  label: string;
  current: number;
  goal: number;
  points: number;
  complete: boolean;
  position: number;
  description: string | null;
  /**
   * A one-of-several-sets tile ("One full barrows set"): the closest set by name, and the set the
   * team's latest piece went to when that's another one — "Guthan's 3/4 · last Dharok's 2/4". The
   * count alone is the closest set's, so a Dharok piece that didn't move it looked lost.
   */
  sets?: string;
}

/** A tile someone on the caller's team worked in the last {@link ACTIVE_WINDOW_MS}. */
export interface PanelActive {
  tileId: number;
  /** Who, newest first; the caller is "You" and leads. */
  workers: string[];
  self: boolean;
  /** Each worker's event gain on a stat tile (KC/XP), when known. */
  gains?: Record<string, number>;
}

export interface PanelView {
  tiles: PanelTile[];
  activeNow: PanelActive[];
  /** The clan's other bingos (never the board the panel already shows), live first then soonest. */
  scheduled: ScheduleBingo[];
  /** Live and upcoming weeklies, live first then soonest. */
  weeklies: ScheduleWeekly[];
}

export const ACTIVE_WINDOW_MS = 5 * 60_000;
export const MAX_ACTIVE = 4;
export const YOU = 'You';

// ── Tile rows ─────────────────────────────────────────────────────────────────────────────────────

interface Req {
  itemId?: number;
  requiredAmount: number;
  currentAmount: number;
  group?: string | null;
  groupRequire?: number | null;
}

/** The config's tracked tiles, as far as the rows need them (every list is optional). */
export interface TrackedLists {
  completedTiles?: { tileId: number }[];
  trackedDrops?: (Base & { requiredAmount: number; itemRequirements?: Req[]; groupMode?: string; setsRequired?: number; lastItemId?: number | null })[];
  trackedStats?: (Base & { goalAmount: number })[];
  trackedKills?: (Base & { requiredAmount: number })[];
  trackedPvp?: (Base & { requiredAmount: number })[];
  trackedDiaries?: (Base & { requiredAmount: number })[];
  trackedCombatTasks?: (Base & { requiredAmount: number })[];
  trackedTimed?: (Omit<Base, 'currentAmount'> & { completed?: boolean })[];
  trackedLms?: (Base & { requiredAmount: number })[];
  trackedValues?: (Omit<Base, 'currentAmount'> & { mode?: string; thresholdGp: number; currentGp: number; completed?: boolean })[];
  trackedGains?: (Base & { requiredAmount: number })[];
  trackedDeathless?: (Base & { requiredAmount: number })[];
}

interface Base {
  tileId: number;
  label: string;
  points: number;
  position: number;
  description: string | null;
  currentAmount: number;
}

const INT_MAX = 2_147_483_647;

/** A gp amount squeezed into the int the plugin's bar is drawn from; both ends clamp together. */
function clampGp(gp: number): number {
  return gp <= 0 ? 0 : Math.min(gp, INT_MAX);
}

/**
 * The row for every tile the plugin tracks. Status follows the plugin's old rule: done when the site
 * says so, else when the count reaches the goal; a goal of 0 is done on any progress.
 */
export function panelTiles(cfg: TrackedLists): PanelTile[] {
  const done = new Set((cfg.completedTiles ?? []).map((c) => c.tileId));
  const rows: PanelTile[] = [];
  const add = (t: Omit<Base, 'currentAmount'>, current: number, goal: number, complete: boolean, sets?: string | null) =>
    rows.push({
      ...(sets ? { sets } : {}),
      tileId: t.tileId,
      label: t.label ?? '',
      current,
      goal,
      points: t.points ?? 0,
      complete: complete || (goal > 0 ? current >= goal : current > 0),
      position: t.position ?? 0,
      description: t.description ?? null,
    });
  const counted = (list: (Base & { requiredAmount: number })[] | undefined, min = 0) =>
    (list ?? []).forEach((t) => add(t, t.currentAmount, Math.max(min, t.requiredAmount), done.has(t.tileId)));

  for (const d of cfg.trackedDrops ?? []) {
    if (d.itemRequirements?.length) {
      const [current, goal, complete] = collectionProgress(d.itemRequirements, d.groupMode, d.setsRequired ?? 1);
      add(d, current, goal, complete || done.has(d.tileId), complete ? null : setsLine(d.itemRequirements, d.groupMode, d.setsRequired ?? 1, d.lastItemId ?? null));
    } else {
      add(d, d.currentAmount, d.requiredAmount, done.has(d.tileId));
    }
  }
  for (const s of cfg.trackedStats ?? []) add(s, s.currentAmount, s.goalAmount, done.has(s.tileId));
  counted(cfg.trackedKills);
  counted(cfg.trackedPvp);
  counted(cfg.trackedDiaries);
  counted(cfg.trackedCombatTasks);
  for (const t of cfg.trackedTimed ?? []) {
    const complete = !!t.completed || done.has(t.tileId);
    add(t, complete ? 1 : 0, 1, complete);
  }
  counted(cfg.trackedLms, 1);
  for (const v of cfg.trackedValues ?? []) {
    const complete = !!v.completed || done.has(v.tileId);
    if (v.mode?.toLowerCase() === 'total') {
      const goal = clampGp(v.thresholdGp);
      add(v, Math.min(clampGp(v.currentGp), goal), goal, complete);
    } else {
      add(v, complete ? 1 : 0, 1, complete);
    }
  }
  counted(cfg.trackedGains, 1);
  counted(cfg.trackedDeathless, 1);
  return rows;
}

/**
 * A collection tile's bar: [current, goal, complete], in pieces. MUST match the plugin's
 * ClogTaskModel.collectionProgress, which still runs in-game the moment a drop lands to raise the
 * row ahead of the next poll — the two numbers meet on the same bar.
 *
 * Ungrouped items are always required. In 'any' mode each set (with the ungrouped items) is one
 * alternative and the bar shows the one closest to done; in 'all' mode every set counts, each capped
 * at its own requirement. An 'any' tile needing N sets counts sets (lib/collectionSets setTimes).
 */
export function collectionProgress(reqs: Req[], groupMode: string | null | undefined, setsRequired: number): [number, number, boolean] {
  const ungrouped: Req[] = [];
  const groups = new Map<string, Req[]>();
  for (const r of reqs) {
    const g = r.group?.trim() ?? '';
    if (!g) ungrouped.push(r);
    else {
      const key = g.toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
  }
  const sat = (rs: Req[]) => rs.filter((r) => r.currentAmount >= Math.max(1, r.requiredAmount)).length;
  const ungroupedSat = sat(ungrouped);
  const ungroupedSize = ungrouped.length;
  const all = groupMode?.toLowerCase() === 'all';

  if (setsRequired > 1 && !all && groups.size > 0) {
    let setsDone = 0;
    let unit = INT_MAX;
    let bestPartial = 0;
    for (const grp of groups.values()) {
      const need = requireCount(grp);
      const times = setTimes(grp, need);
      setsDone += times;
      unit = Math.min(unit, need);
      // Pieces toward this set's NEXT copy.
      const partial = grp.filter((r) => r.currentAmount >= (times + 1) * Math.max(1, r.requiredAmount)).length;
      bestPartial = Math.max(bestPartial, Math.min(partial, need - 1));
    }
    const goal = ungroupedSize + setsRequired * unit;
    const doneSets = Math.min(setsDone, setsRequired);
    const current = ungroupedSat + doneSets * unit + (doneSets < setsRequired ? Math.min(bestPartial, unit - 1) : 0);
    const complete = setsDone >= setsRequired && ungroupedSat >= ungroupedSize;
    return [complete ? goal : Math.min(current, goal - 1), Math.max(1, goal), complete];
  }
  if (groups.size === 0) {
    return [ungroupedSat, Math.max(1, ungroupedSize), ungroupedSize > 0 && ungroupedSat >= ungroupedSize];
  }
  if (all) {
    let current = ungroupedSat;
    let goal = ungroupedSize;
    let setsDone = true;
    for (const grp of groups.values()) {
      const need = requireCount(grp);
      const met = Math.min(sat(grp), need);
      current += met;
      goal += need;
      if (met < need) setsDone = false;
    }
    return [current, Math.max(1, goal), setsDone && ungroupedSat >= ungroupedSize];
  }
  let best: [number, number] = [0, 1];
  let bestRemaining = INT_MAX;
  for (const grp of groups.values()) {
    const need = requireCount(grp);
    const current = ungroupedSat + Math.min(sat(grp), need);
    const size = ungroupedSize + need;
    if (size <= 0) continue;
    if (current >= size) return [size, size, true];
    const remaining = size - current;
    if (remaining < bestRemaining || (remaining === bestRemaining && current > best[0])) {
      bestRemaining = remaining;
      best = [current, size];
    }
  }
  return [best[0], Math.max(1, best[1]), false];
}

/**
 * "Guthan's 3/4 · last Dharok's 2/4" for a tile done by any ONE of several sets: the closest set by
 * name, then the set the latest piece went to when it's a different one. Null for every other shape
 * (one set, every set, several sets of one), where the count already says it.
 */
export function setsLine(reqs: Req[], groupMode: string | null | undefined, setsRequired: number, lastItemId: number | null): string | null {
  if (groupMode?.toLowerCase() === 'all' || setsRequired > 1) return null;
  const groups = new Map<string, { name: string; reqs: Req[] }>();
  for (const r of reqs) {
    const g = r.group?.trim();
    if (!g) continue;
    const key = g.toLowerCase();
    const at = groups.get(key) ?? { name: g.replace(/\s+set$/i, ''), reqs: [] };
    at.reqs.push(r);
    groups.set(key, at);
  }
  if (groups.size < 2) return null;
  const sat = (rs: Req[]) => rs.filter((r) => r.currentAmount >= Math.max(1, r.requiredAmount)).length;
  const line = (g: { name: string; reqs: Req[] }) => {
    const need = requireCount(g.reqs);
    return { text: `${g.name} ${Math.min(sat(g.reqs), need)}/${need}`, left: need - Math.min(sat(g.reqs), need), have: sat(g.reqs) };
  };
  const all = [...groups.values()].map((g) => ({ g, ...line(g) }));
  const best = all.reduce((a, b) => (b.left < a.left || (b.left === a.left && b.have > a.have) ? b : a));
  const last = lastItemId == null ? undefined : all.find((x) => x.g.reqs.some((r) => r.itemId === lastItemId));
  return last && last !== best ? `${best.text} · last ${last.text}` : best.text;
}

/** Distinct items a set needs: the strictest declaration, clamped to the set's size. */
function requireCount(grp: Req[]): number {
  const declared = Math.max(0, ...grp.map((r) => r.groupRequire ?? 0));
  return Math.min(Math.max(1, declared > 0 ? declared : grp.length), grp.length);
}

/** Times over a set is done: the largest k with `need` of its items at k × their amount. */
function setTimes(grp: Req[], need: number): number {
  const perItem = grp.map((r) => Math.floor(r.currentAmount / Math.max(1, r.requiredAmount))).sort((a, b) => b - a);
  return perItem[Math.min(need, perItem.length) - 1] ?? 0;
}

// ── Active now ────────────────────────────────────────────────────────────────────────────────────

/** One sighting of somebody working a tile: a credited submission, or a stat that just rose. */
export interface WorkSighting {
  tileId: number;
  name: string;
  self: boolean;
  atMs: number;
  /** Their event gain on a stat tile. */
  gain?: number;
}

/** Newest-active incomplete tiles first, capped; the caller leads each row as "You". */
export function activeNow(tiles: PanelTile[], seen: WorkSighting[], nowMs: number): PanelActive[] {
  const open = new Set(tiles.filter((t) => !t.complete).map((t) => t.tileId));
  const acc = new Map<number, { names: Map<string, number | undefined>; self: boolean; recency: number }>();
  for (const s of seen) {
    if (!open.has(s.tileId) || nowMs - s.atMs > ACTIVE_WINDOW_MS) continue;
    const a = acc.get(s.tileId) ?? { names: new Map(), self: false, recency: 0 };
    const name = s.self ? YOU : s.name;
    a.names.set(name, s.gain ?? a.names.get(name));
    a.self ||= s.self;
    a.recency = Math.max(a.recency, s.atMs);
    acc.set(s.tileId, a);
  }
  return [...acc.entries()]
    .sort((x, y) => y[1].recency - x[1].recency)
    .slice(0, MAX_ACTIVE)
    .map(([tileId, a]) => {
      const workers = [...(a.self ? [YOU] : []), ...[...a.names.keys()].filter((n) => n !== YOU)];
      const gains = Object.fromEntries([...a.names].filter(([, g]) => g != null)) as Record<string, number>;
      return { tileId, workers, self: a.self, ...(Object.keys(gains).length ? { gains } : {}) };
    });
}

// ── Schedule ──────────────────────────────────────────────────────────────────────────────────────

/** Live first, then soonest start (ISO strings sort chronologically); undated last. */
function scheduleOrder(a: { status: string; startDate: string | null }, b: { status: string; startDate: string | null }): number {
  const la = a.status === 'active';
  const lb = b.status === 'active';
  if (la !== lb) return la ? -1 : 1;
  const sa = a.startDate ?? '';
  const sb = b.startDate ?? '';
  if (!sa !== !sb) return sa ? -1 : 1;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * The schedule as the panel lists it: never the board the panel already shows (by id, or by name
 * for a board the caller can see but isn't resolved on), live first then soonest.
 */
export function panelSchedule(schedule: PluginSchedule, shown: { ids: number[]; title?: string | null }): Pick<PanelView, 'scheduled' | 'weeklies'> {
  const hidden = new Set(shown.ids.filter((id) => id > 0));
  return {
    scheduled: schedule.bingos
      .filter((b) => !hidden.has(b.id) && (!shown.title || b.title !== shown.title))
      .sort(scheduleOrder),
    weeklies: [...schedule.weeklies].sort(scheduleOrder),
  };
}
