import { SKILLS } from '@/lib/constants';
import { getMaxRatePerHour } from '@/lib/gainsValidation';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { isActivityKey, readActivityScore } from '@/lib/hiscoresActivities';
import { computeGainFromJson, type MilestoneState } from '@/lib/statTracking';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// KC / XP from a GAME-MODE world (Leagues, Deadman, hardcore, … — lib/worldModes) on a board that
// counts that mode (rules.worldModes).
//
// A mode world is a separate save, so its numbers can never go where the main game's live: not the
// account's live overlay (read by weekly SOTW/BOTW, the profile and every other board), not stat
// history, not the hiscores snapshots. They're kept on the BOARD ROW instead —
// event_participants.mode_stats, written only for boards that opted in — as, per mode,
//
//   { "hardcore": { "first": { "zulrah": 3 }, "cur": { "zulrah": 9 } } }
//
// `first` is the first reading that mode sent for the key after the board started, `cur` the
// highest since. The mode's gain is measured from its OWN first reading, never from the row's
// hiscores baseline: that snapshot is the main game's numbers (a Leagues save shares the main
// account's name, so a lookup reads the main hiscores), and the mode save starts somewhere else
// entirely.
//
// A kill count, clue count or other counter is only pushed when it moves — the push IS the kill —
// so its first reading already includes one gain: that one is counted back in (KC_SLACK). XP is sent
// at login before any gain, so it isn't.
//
// Main and mode progress combine PER KEY as the larger of the two, never the sum: for a hardcore
// character enrolled under its own name, its hiscores and its pushes are the same kills, and summing
// would count them twice. Taking the larger can only ever under-count.
//
// CHECKED AGAINST THE MODE'S OWN HISCORES (lib/modeHiscores maps a mode to its table). A modified
// client can send any world header, so a pushed reading only counts as far as that table backs it,
// by the same rules the main game's live overlay follows (lib/statTracking reconcileLive /
// pruneStaleOverlay):
//
//   corroborated  the table has caught up (h >= pushed): the table's value counts.
//   ahead         pushed above the table, and the reading first went unconfirmed (`up`: the oldest
//                 rise the table hasn't caught up to) less than MODE_STALE_MS before the read. The
//                 plugin is legitimately ahead until the player logs out, and OSRS logs everyone out
//                 by 6h. What counts above the table is bounded by plausible growth SINCE THE READ:
//                 min(pushed, h + plausible rise between the read and the latest rise) — a rise
//                 the read already saw and didn't show counts only as h. So a lead can't be
//                 invented before a read and carried past it.
//   contradicted  pushed above the table, and the table was read MODE_STALE_MS or more after the
//                 reading FIRST went unconfirmed. The clock runs from the oldest unconfirmed rise,
//                 so nudging the reading up every few hours never restarts it. Hiscores must reflect
//                 it by then, so the excess is not real: only h counts, plus plausible growth since
//                 the read, and staff see the mismatch (modeReadingIssues). It is STICKY (`bad`,
//                 the h it was contradicted at): later pushes add only plausible growth on top of
//                 the table, never resume from the rejected value, until the table catches up.
//                 A key with no unconfirmed-rise stamp (a row written before stamps existed) is
//                 taken as stale, exactly as the main overlay treats a missing stamp.
//   unverified    nothing to check against — the mode has no table (beta, a mode we had no entry
//                 for, seasonal Deadman until its table is confirmed), the save isn't on its table
//                 (404: a fresh character below the rank thresholds), the table doesn't list this
//                 key (KC below the listing minimum), or no read has landed yet. Counts, but only
//                 at a plausible rate.
//
// Plausible rate: what isn't backed by the table can rise no faster than the weekly anti-cheat's
// per-skill / per-boss ceilings (lib/gainsValidation) over the time between the key's first and
// latest reading. Those ceilings are generous, so honest play never meets them.
//
// MILESTONE tiles complete only on what the table itself shows: crossing a lifetime threshold is a
// single yes/no that nothing would ever revisit, so the table has to list every key the tile reads
// and its values — not a pushed lead, however plausible — have to reach the goal.
//
// THE STARTING LINE is checked too. A reading only ever goes up, so a save the table lists at h,
// read some hours after a key's first reading, was at least h minus what it could plausibly have
// gained in those hours when that first reading was sent. A first reading below that is raised to
// it (`base`) — a client can't send a falsely low first number to inflate its gain — and staff see
// that as well. Reads are queued right after a new key's first reading (lib/modeHiscoresQueue), so
// the margin is minutes of play.
//
// Pure (no db).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ModeHiscoresRead {
  /** When the table was read (ISO, the fetch time). */
  at: string;
  /** 'ok' = the save is on the table; 'absent' = the table has no such player (404 / unranked). */
  status: 'ok' | 'absent';
  /** The table's value for each key this row had readings for, where the table lists one (> 0). */
  v: Record<string, number>;
}

export interface ModeStatEntry {
  first: Record<string, number>;
  cur: Record<string, number>;
  /** When each key's first reading came in (ISO). Missing on rows written before stamps existed. */
  ft?: Record<string, string>;
  /** When each key's current reading last rose (ISO). */
  at?: Record<string, string>;
  /** The latest read of this mode's hiscores table. */
  hs?: ModeHiscoresRead;
  /** Per key, the starting line the table corroborates, where it is above the first reading. */
  base?: Record<string, number>;
  /** Per key, when the reading first rose above what the table has confirmed (ISO). Cleared once a
   * read catches up. Only a read moves it forward, never a push. */
  up?: Record<string, string>;
  /** Per key, the pushed value at that moment: once the table passes it, that lead was real. */
  upv?: Record<string, number>;
  /** Per key, the table value a reading was contradicted at. Sticky until the table catches up. */
  bad?: Record<string, number>;
}
export type ModeStats = Record<string, ModeStatEntry>;

/** A counter's first push is the gain that triggered it. */
const KC_SLACK = 1;
const MAX_MODES = 8;
const SKILL_KEYS: ReadonlySet<string> = new Set(SKILLS.filter((s) => s !== 'overall'));
const ALL_SKILLS: ReadonlySet<string> = new Set(SKILLS);

/**
 * How long a reading may sit above its table before the table is taken to contradict it. The same
 * window as the main game's overlay (statsSweep STALE_OVERLAY_MS): OSRS logs everyone out by 6h.
 */
export const MODE_STALE_MS = 6.5 * 60 * 60_000;

function cleanMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
  }
  return out;
}

function cleanStamps(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && Number.isFinite(Date.parse(v))) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanRead(raw: unknown): ModeHiscoresRead | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as { at?: unknown; status?: unknown; v?: unknown };
  if (typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at))) return undefined;
  if (r.status !== 'ok' && r.status !== 'absent') return undefined;
  return { at: r.at, status: r.status, v: cleanMap(r.v) };
}

/** event_participants.mode_stats → per-mode readings. Garbage reads as nothing. */
export function parseModeStats(json: string | null | undefined): ModeStats {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ModeStats = {};
    for (const [mode, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as {
        first?: unknown;
        cur?: unknown;
        ft?: unknown;
        at?: unknown;
        hs?: unknown;
        base?: unknown;
        up?: unknown;
        upv?: unknown;
        bad?: unknown;
      };
      const clean: ModeStatEntry = { first: cleanMap(e.first), cur: cleanMap(e.cur) };
      const ft = cleanStamps(e.ft);
      const at = cleanStamps(e.at);
      const hs = cleanRead(e.hs);
      const base = cleanMap(e.base);
      if (ft) clean.ft = ft;
      if (at) clean.at = at;
      if (hs) clean.hs = hs;
      if (Object.keys(base).length) clean.base = base;
      const up = cleanStamps(e.up);
      const upv = cleanMap(e.upv);
      const bad = cleanMap(e.bad);
      if (up) clean.up = up;
      if (Object.keys(upv).length) clean.upv = upv;
      if (Object.keys(bad).length) clean.bad = bad;
      out[mode] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Fold one push from `mode` into a row's readings: `cur` only rises, `first` is set once per key,
 * and each is stamped (`ft` / `at`) so the hiscores check can tell when it happened.
 * Returns the JSON to store, or null when nothing changed (skip the write).
 */
export function mergeModePush(
  json: string | null | undefined,
  mode: string,
  pushed: Record<string, number>,
  nowIso: string = new Date().toISOString(),
): string | null {
  const all = parseModeStats(json);
  if (!all[mode] && Object.keys(all).length >= MAX_MODES) return null;
  const entry = all[mode] ?? { first: {}, cur: {} };
  const ft = { ...(entry.ft ?? {}) };
  const at = { ...(entry.at ?? {}) };
  const up = { ...(entry.up ?? {}) };
  const upv = { ...(entry.upv ?? {}) };
  let changed = false;
  for (const [key, raw] of Object.entries(pushed)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) continue;
    const v = Math.floor(raw);
    if (entry.first[key] == null) {
      entry.first[key] = v;
      ft[key] = nowIso;
      changed = true;
    }
    if (v > (entry.cur[key] ?? -1)) {
      entry.cur[key] = v;
      at[key] = nowIso;
      // The oldest rise the table hasn't confirmed. A later rise never moves it (that would let a
      // client drip-feed its way out of the staleness check); only a read that catches up does.
      if (up[key] == null && !(entry.hs?.status === 'ok' && (entry.hs.v[key] ?? 0) >= v)) {
        up[key] = nowIso;
        upv[key] = v;
      }
      changed = true;
    }
  }
  if (!changed) return null;
  entry.ft = ft;
  entry.at = at;
  if (Object.keys(up).length) {
    entry.up = up;
    entry.upv = upv;
  }
  all[mode] = entry;
  return JSON.stringify(all);
}

function ms(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function rateType(statType: string): 'skill' | 'boss' {
  return statType === 'skill' ? 'skill' : 'boss';
}

/** The most `key` could plausibly rise in `hours`, by the weekly anti-cheat's ceilings. */
function plausibleRise(key: string, statType: string, hours: number): number {
  return Math.ceil(getMaxRatePerHour(rateType(statType), key) * Math.max(0, hours));
}

export type ModeReadingState = 'corroborated' | 'ahead' | 'contradicted' | 'unverified';

export interface ModeKeyReading {
  /** The starting line: the first reading (a counter's first kill counted back in), raised to the
   * table's floor when the table shows the first reading was too low. */
  start: number;
  /** The value that counts. */
  credited: number;
  /** The highest value the plugin pushed. */
  pushed: number;
  /** The table's value, or null when it has none for this key. */
  hiscores: number | null;
  state: ModeReadingState;
  /** The plausible-rate cap held the pushed value back. */
  capped: boolean;
  /** The table raised the starting line above the first reading. */
  lowStart: boolean;
}

/** One key on one mode save, checked against that mode's hiscores. Null when it has no readings. */
export function resolveModeKey(entry: ModeStatEntry, key: string, statType: string): ModeKeyReading | null {
  const first = entry.first[key];
  const pushed = entry.cur[key];
  if (first == null || pushed == null) return null;
  const slack = statType === 'skill' ? 0 : first > 0 ? KC_SLACK : 0;
  const pushedStart = Math.max(0, first - slack);
  const floor = entry.base?.[key];
  const lowStart = floor != null && floor > pushedStart;
  const start = lowStart ? floor : pushedStart;

  // Plausible: the first reading plus what the key could have gained between its first and latest
  // reading. A row from before readings were stamped has no clock to measure against — uncapped.
  const firstAt = ms(entry.ft?.[key]);
  const roseAt = ms(entry.at?.[key]);
  const allowance = firstAt == null ? Infinity : first + plausibleRise(key, statType, ((roseAt ?? firstAt) - firstAt) / 3_600_000);
  const plausible = Math.min(pushed, allowance);

  const listed = entry.hs?.status === 'ok' ? entry.hs.v[key] : undefined;
  const h = listed != null && listed > 0 ? listed : null;
  if (h != null) {
    if (pushed <= h) return { start, credited: h, pushed, hiscores: h, state: 'corroborated', capped: false, lowStart };
    const readAt = ms(entry.hs!.at)!;
    // Above the table: only plausible growth SINCE THE READ counts on top of it. A rise the read
    // already saw (and didn't show) counts as h.
    const sinceRead = roseAt != null && roseAt > readAt ? plausibleRise(key, statType, (roseAt - readAt) / 3_600_000) : 0;
    const credited = Math.max(h, Math.min(pushed, h + sinceRead));
    const unconfirmedSince = ms(entry.up?.[key]);
    const contradicted =
      entry.bad?.[key] != null || unconfirmedSince == null || readAt - unconfirmedSince >= MODE_STALE_MS;
    return {
      start,
      credited,
      pushed,
      hiscores: h,
      state: contradicted ? 'contradicted' : 'ahead',
      capped: !contradicted && credited < pushed,
      lowStart,
    };
  }
  return { start, credited: plausible, pushed, hiscores: null, state: 'unverified', capped: plausible < pushed, lowStart };
}

/** One key's gain on one mode save since the board started. */
function keyGain(entry: ModeStatEntry, key: string, statType: string): number {
  const r = resolveModeKey(entry, key, statType);
  return r ? Math.max(0, r.credited - r.start) : 0;
}

/** Total XP on a mode save: every skill it reported, each from its own first reading. */
function overallGain(entry: ModeStatEntry): number {
  let sum = 0;
  for (const key of Object.keys(entry.cur)) if (SKILL_KEYS.has(key)) sum += keyGain(entry, key, 'skill');
  return sum;
}

/** The best gain any counted mode shows for one key. */
function bestModeGain(modes: ModeStats, counted: readonly string[], key: string, statType: string): number {
  let best = 0;
  for (const mode of counted) {
    const entry = modes[mode];
    if (!entry) continue;
    const g = statType === 'skill' && key === 'overall' ? overallGain(entry) : keyGain(entry, key, statType);
    if (g > best) best = g;
  }
  return best;
}

/**
 * A board row's gain for a stat tile: the main-game gain (lib/statTracking computeGain — hiscores and
 * the live overlay over the row's baseline), raised per key by any mode the board counts.
 * With no counted modes, or no mode readings, it is exactly computeGainFromJson.
 */
export function statGainWithModes(
  baselineJson: string | null | undefined,
  currentJson: string | null | undefined,
  liveMap: Record<string, number>,
  keys: string[],
  statType: string,
  modeStatsJson: string | null | undefined,
  counted: readonly string[],
): number {
  const modes = counted.length > 0 ? parseModeStats(modeStatsJson) : {};
  if (!counted.some((m) => modes[m])) return computeGainFromJson(baselineJson, currentJson, liveMap, keys, statType);
  let total = 0;
  for (const key of keys) {
    const main = computeGainFromJson(baselineJson, currentJson, liveMap, [key], statType);
    total += Math.max(main, bestModeGain(modes, counted, key, statType));
  }
  return total;
}

/**
 * A lifetime-threshold (milestone) tile on a mode save: eligible only when every key's starting line
 * this event was below the goal, reached once the save's own lifetime total gets there — and only
 * when the mode's hiscores list every key (an unverified reading never completes a milestone). The
 * main game's state wins when it has already reached; otherwise a counted mode that has does.
 */
export function milestoneWithModes(
  main: MilestoneState,
  modeStatsJson: string | null | undefined,
  counted: readonly string[],
  keys: string[],
  statType: string,
  goal: number,
): MilestoneState {
  if (main.reached || counted.length === 0) return main;
  const modes = parseModeStats(modeStatsJson);
  for (const mode of counted) {
    const entry = modes[mode];
    if (!entry) continue;
    const readings = keys.map((k) => resolveModeKey(entry, k, statType));
    if (readings.some((r) => r == null || r.hiscores == null)) continue;
    const start = readings.reduce((n, r) => n + r!.start, 0);
    // What the table shows, never a pushed lead (credited may sit above it while 'ahead').
    const lifetime = readings.reduce((n, r) => n + r!.hiscores!, 0);
    if (start < goal && lifetime >= goal) return { lifetime, eligible: true, reached: true };
  }
  return main;
}

/** The stat type a bare key reads as: a skill's XP, or a count (boss KC, clues, activities). */
export function modeKeyStatType(key: string): 'skill' | 'boss' {
  return ALL_SKILLS.has(key) ? 'skill' : 'boss';
}

// ── Reads of the mode's hiscores table (lib/modeHiscoresQueue) ───────────────────────────────────

/** A key's value on a mode table, as the table lists it: <= 0 means not listed. */
function tableValue(snapshot: HiscoresSnapshot, key: string): number {
  if (ALL_SKILLS.has(key)) return snapshot.skills?.[key]?.xp ?? -1;
  if (isActivityKey(key)) return readActivityScore(snapshot, key);
  return snapshot.bosses?.[key]?.score ?? -1;
}

/**
 * Fold one read of `mode`'s hiscores table into a row's readings. `snapshot` null = the save is not
 * on the table (404). A read no newer than the one already held changes nothing.
 *
 * Records the table's value for every key the row has readings for, and raises a key's starting line
 * where the table shows the first reading was too low (see the header). Returns the JSON to store,
 * or null when there is nothing to change.
 */
export function applyModeRead(
  json: string | null | undefined,
  mode: string,
  read: { at: string; snapshot: HiscoresSnapshot | null },
): string | null {
  const all = parseModeStats(json);
  const entry = all[mode];
  const readAt = ms(read.at);
  if (!entry || readAt == null) return null;
  const heldAt = ms(entry.hs?.at);
  if (heldAt != null && heldAt >= readAt) return null;

  const keys = new Set([...Object.keys(entry.first), ...Object.keys(entry.cur)]);
  const v: Record<string, number> = {};
  if (read.snapshot) {
    for (const key of keys) {
      const h = tableValue(read.snapshot, key);
      if (Number.isFinite(h) && h > 0) v[key] = Math.floor(h);
    }
  }
  entry.hs = { at: read.at, status: read.snapshot ? 'ok' : 'absent', v };

  // The unconfirmed-lead clock and the sticky contradiction, per key the table lists.
  const up = { ...(entry.up ?? {}) };
  const upv = { ...(entry.upv ?? {}) };
  const bad = { ...(entry.bad ?? {}) };
  for (const [key, cur] of Object.entries(entry.cur)) {
    const h = v[key];
    if (h == null) continue; // nothing to confirm or contradict with
    if (h >= cur) {
      // Caught up: every rise so far is confirmed.
      delete up[key];
      delete upv[key];
      delete bad[key];
      continue;
    }
    if (up[key] != null && upv[key] != null && h >= upv[key]) {
      // The table passed the value the lead started at, so that lead was real. What is still above
      // the table began after it; restart the clock at the latest rise the read could have seen.
      const rose = ms(entry.at?.[key]);
      up[key] = new Date(Math.min(rose ?? readAt, readAt)).toISOString();
      upv[key] = cur;
      delete bad[key];
    }
    const since = ms(up[key]);
    if (bad[key] == null && (since == null || readAt - since >= MODE_STALE_MS)) bad[key] = h;
  }
  for (const [name, map] of [['up', up], ['upv', upv], ['bad', bad]] as const) {
    if (Object.keys(map).length) (entry as unknown as Record<string, unknown>)[name] = map;
    else delete (entry as unknown as Record<string, unknown>)[name];
  }

  // The starting line: the save was at least h − plausible rise since the first reading, back then.
  const base = { ...(entry.base ?? {}) };
  for (const [key, first] of Object.entries(entry.first)) {
    const h = v[key];
    const firstAt = ms(entry.ft?.[key]);
    if (h == null || firstAt == null) continue;
    const statType = modeKeyStatType(key);
    const slack = statType === 'skill' ? 0 : first > 0 ? KC_SLACK : 0;
    const floor = h - plausibleRise(key, statType, (readAt - firstAt) / 3_600_000) - slack;
    if (floor > Math.max(0, first - slack) && floor > (base[key] ?? -1)) base[key] = floor;
  }
  if (Object.keys(base).length) entry.base = base;
  all[mode] = entry;
  return JSON.stringify(all);
}

/** Re-read a save whose readings moved since the last read at most this often. */
export const MODE_READ_EVERY_MS = 60 * 60_000;
/** …or, for a save the table didn't have, this often (it may need hours to be ranked). */
export const MODE_ABSENT_READ_EVERY_MS = 3 * 60 * 60_000;
/** A new key's starting line wants a read soon; no sooner than this after the previous one. */
export const MODE_NEW_KEY_GAP_MS = 10 * 60_000;

export interface ModeReadDue {
  due: boolean;
  /** A starting line is waiting on this read: queue it in the competition lane. */
  urgent: boolean;
}

/**
 * Does this mode save want its table read now? Only a save whose readings moved does — an idle one
 * costs nothing:
 *  - never read, or a key first seen since the last read (its starting line): urgent;
 *  - a reading rose since the last read, which is older than MODE_READ_EVERY_MS (absent: longer);
 *  - a reading has been above the table for MODE_STALE_MS since it first went unconfirmed, and the
 *    last read predates that: the read that confirms or contradicts it.
 */
export function modeReadDue(entry: ModeStatEntry, nowMs: number): ModeReadDue {
  const keys = Object.keys(entry.cur);
  if (keys.length === 0) return { due: false, urgent: false };
  const readAt = ms(entry.hs?.at);
  if (readAt == null) return { due: true, urgent: true };
  const since = nowMs - readAt;
  if (keys.some((k) => (ms(entry.ft?.[k]) ?? -Infinity) > readAt) && since >= MODE_NEW_KEY_GAP_MS) {
    return { due: true, urgent: true };
  }
  const every = entry.hs!.status === 'absent' ? MODE_ABSENT_READ_EVERY_MS : MODE_READ_EVERY_MS;
  if (keys.some((k) => (ms(entry.at?.[k]) ?? -Infinity) > readAt) && since >= every) return { due: true, urgent: false };
  if (entry.hs!.status === 'ok') {
    for (const k of keys) {
      const h = entry.hs!.v[k];
      const since = ms(entry.up?.[k]);
      if (h == null || h >= entry.cur[k] || since == null || entry.bad?.[k] != null) continue;
      if (nowMs - since >= MODE_STALE_MS && readAt - since < MODE_STALE_MS) return { due: true, urgent: false };
    }
  }
  return { due: false, urgent: false };
}

export interface ModeReadingIssue {
  mode: string;
  key: string;
  /** contradicted: the table read long after says less. low-start: the first reading was below
   * what the table allows. capped: rising faster than is plausible, held back. */
  kind: 'contradicted' | 'low-start' | 'capped';
  pushed: number;
  hiscores: number | null;
  /** The first reading the plugin sent. */
  first: number;
  /** The starting line that counts. */
  start: number;
}

/** What staff should see about one row's mode readings for these keys (empty when all is well). */
export function modeReadingIssues(
  modeStatsJson: string | null | undefined,
  counted: readonly string[],
  keys: string[],
  statType: string,
): ModeReadingIssue[] {
  if (counted.length === 0) return [];
  const modes = parseModeStats(modeStatsJson);
  const out: ModeReadingIssue[] = [];
  for (const mode of counted) {
    const entry = modes[mode];
    if (!entry) continue;
    const expanded = statType === 'skill' && keys.includes('overall') ? [...new Set([...keys, ...Object.keys(entry.cur).filter((k) => SKILL_KEYS.has(k))])] : keys;
    for (const key of expanded) {
      if (key === 'overall' && statType === 'skill') continue;
      const r = resolveModeKey(entry, key, statType);
      if (!r) continue;
      const base = { mode, key, pushed: r.pushed, hiscores: r.hiscores, first: entry.first[key], start: r.start };
      if (r.state === 'contradicted') out.push({ ...base, kind: 'contradicted' });
      else if (r.capped) out.push({ ...base, kind: 'capped' });
      if (r.lowStart) out.push({ ...base, kind: 'low-start' });
    }
  }
  return out;
}

/** The modes a board counts, from its parsed rules (empty = main game only). */
export function countedModes(rules: { worldModes?: readonly string[] } | null | undefined): string[] {
  return Array.isArray(rules?.worldModes) ? [...rules.worldModes] : [];
}
