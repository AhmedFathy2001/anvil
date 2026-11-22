/**
 * Conditions on a raid, kill, drop or log tile: which raids and modes count, per-raid time / party /
 * scale / challenge-time bars, and tile-wide rules (nobody dies, teammates in the raid, the player's
 * count when the event started).
 *
 * This is the contract between the creator UI, the site's judging (lib/pluginFacts) and the plugin's
 * `raid` fact. Pure: no database, so the UI and tests import it freely.
 *
 * The plugin reports what it saw on every raid clear ({@link RaidRun}); the site decides. Nothing
 * here is judged in the client, so a rule change never needs a plugin release.
 */
import type { RaidId, RaidModeId } from '@/lib/tileCreatorConfig';

export type { RaidId, RaidModeId };

/** Party size against a number: exactly, at least or at most. */
export interface PartyBar {
  op: 'eq' | 'gte' | 'lte';
  n: number;
}

/**
 * One raid on the tile and the bar its clears must clear. `modes` for CoX (normal|cm), ToB
 * (entry|normal|hard) and TFA (normal). ToA is picked by raid level instead: `toa`.
 */
export interface RaidPick {
  raid: RaidId;
  modes?: RaidModeId[];
  /** ToA only: the level the raid ENDS at (after a missed timer's penalty), and whether Entry (<150) counts. */
  toa?: { min: number; entry: boolean };
  /** Under this many seconds. */
  under?: number | null;
  /** CoX CM / ToB HM only: inside the game's challenge time for the party (see challengeSeconds). */
  challenge?: boolean;
  party?: PartyBar | null;
  /** CoX only: scaled to at least this team size. */
  scale?: number | null;
}

/** The player's own count of the thing when the event started: under or over a number. */
export interface StartCount {
  op: 'lt' | 'gt';
  n: number;
}

export interface TileConditions {
  v: 1;
  /** A raid tile: any one of these, each with its own bar. */
  raids?: RaidPick[];
  /** Every raid: nobody in the party dies. */
  noDeaths?: boolean;
  /** Every raid: at least `min` players from the team inside, or `all` the party on the team. */
  mates?: { min: number } | { all: true } | null;
  /** Several teammates in one raid: each of them counts it ('each', the default), or it counts once. */
  shared?: 'each' | 'together';
  /** Kill / raid / log tiles: the count when the event started. */
  startCount?: StartCount | null;
  /** Drop tiles whose items come from ToA: the raid the drop came from ended at this level or more. */
  toaLevel?: { min: number; entry: boolean } | null;
}

// ─── The game's numbers ──────────────────────────────────────────────────────────────────────

/** ToA: the mode a raid level is. Entry below 150, Normal 150–299, Expert 300 and up. */
export function toaModeFor(level: number): 'entry' | 'normal' | 'expert' {
  return level >= 300 ? 'expert' : level >= 150 ? 'normal' : 'entry';
}

/** CoX Challenge Mode target time by scaled team size (the wiki's table). */
const COX_CM_BANDS: { upTo: number; sec: number }[] = [
  { upTo: 1, sec: 70 * 60 },
  { upTo: 2, sec: 65 * 60 },
  { upTo: 3, sec: 50 * 60 },
  { upTo: 4, sec: 45 * 60 },
  { upTo: 10, sec: 42 * 60 },
  { upTo: 15, sec: 45 * 60 },
  { upTo: 23, sec: 60 * 60 },
  { upTo: Infinity, sec: 80 * 60 },
];

/** ToB Hard Mode challenge time by party size, 1 to 5. */
const TOB_HM_SECONDS: Record<number, number> = { 1: 70 * 60, 2: 35 * 60, 3: 30 * 60, 4: 27 * 60, 5: 25 * 60 };

/**
 * The challenge time a clear has to beat, or null where the game sets none (Normal CoX, ToB other
 * than Hard Mode, ToA, TFA). CoX goes by the size the raid was scaled to; ToB by the party.
 */
export function challengeSeconds(raid: RaidId, mode: RaidModeId, size: number): number | null {
  if (!Number.isFinite(size) || size < 1) return null;
  if (raid === 'cox' && mode === 'cm') return COX_CM_BANDS.find((b) => size <= b.upTo)!.sec;
  if (raid === 'tob' && mode === 'hard') return TOB_HM_SECONDS[Math.min(5, Math.floor(size))] ?? null;
  return null;
}

/** Which conditions a raid card can offer: the menu lists only these. */
export function raidOffers(raid: RaidId, modes: RaidModeId[]): { under: true; party: true; challenge: boolean; scale: boolean } {
  return {
    under: true,
    party: true,
    challenge: (raid === 'cox' && modes.includes('cm')) || (raid === 'tob' && modes.includes('hard')),
    scale: raid === 'cox',
  };
}

// ─── What the plugin saw ─────────────────────────────────────────────────────────────────────

/**
 * One raid clear, as the plugin's `raid` fact reports it. `mode` is the one the completion line
 * named (ToA: from `lvl`). Absent numbers were not seen; a bar that needs one then refuses.
 */
export interface RaidRun {
  raid: RaidId;
  mode: RaidModeId;
  /** Clear time in seconds. */
  sec?: number | null;
  /** Players inside the raid. */
  party?: number | null;
  /** CoX: the team size the raid was scaled to. */
  scale?: number | null;
  /** Party deaths seen. */
  deaths?: number | null;
  /** ToA: the level at the chest. */
  lvl?: number | null;
  /** Teammates (the player's own team) inside, the player included. */
  mates?: number | null;
  /** Everyone inside is on the team. */
  allMates?: boolean | null;
}

export type Refusal = { ok: false; why: string };
export type Verdict = { ok: true; pick: RaidPick } | Refusal;

const no = (why: string): Refusal => ({ ok: false, why });

function partyOk(bar: PartyBar, n: number): boolean {
  return bar.op === 'eq' ? n === bar.n : bar.op === 'gte' ? n >= bar.n : n <= bar.n;
}

export function partyWords(bar: PartyBar): string {
  if (bar.op === 'eq') return bar.n === 1 ? 'solo' : bar.n === 2 ? 'duo' : bar.n === 3 ? 'trio' : `${bar.n} players`;
  return bar.op === 'gte' ? `${bar.n}+ players` : `up to ${bar.n} players`;
}

export function clockWords(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Does this one raid pick take the run? The first refusal, in plain words, when not. */
export function pickAccepts(pick: RaidPick, run: RaidRun): { ok: true } | Refusal {
  if (pick.raid !== run.raid) return no('a different raid');
  if (run.raid === 'toa') {
    const bar = pick.toa ?? { min: 150, entry: false };
    if (run.lvl == null) return no('the raid level was not seen');
    // Counts at the level or above, or as an Entry run (<150) when Entry is ticked.
    const entryRun = run.lvl < 150;
    if (!(run.lvl >= bar.min || (entryRun && bar.entry))) {
      return no(entryRun && !bar.entry ? 'Entry Mode does not count here' : `raid level ${run.lvl}, needs ${bar.min}+`);
    }
  } else if (!(pick.modes ?? []).includes(run.mode)) {
    return no(`${run.mode === 'cm' ? 'Challenge Mode' : run.mode === 'hard' ? 'Hard Mode' : run.mode === 'entry' ? 'Entry Mode' : 'Normal'} does not count here`);
  }
  if (pick.party) {
    if (run.party == null) return no('the party size was not seen');
    if (!partyOk(pick.party, run.party)) return no(`party of ${run.party}, needs ${partyWords(pick.party)}`);
  }
  if (pick.scale && pick.raid === 'cox') {
    if (run.scale == null) return no('the raid scale was not seen');
    if (run.scale < pick.scale) return no(`scaled to ${run.scale}, needs ${pick.scale}+`);
  }
  if (pick.under != null) {
    if (run.sec == null) return no('the clear time was not seen');
    if (run.sec >= pick.under) return no(`${clockWords(run.sec)}, needs under ${clockWords(pick.under)}`);
  }
  if (pick.challenge) {
    const size = run.raid === 'cox' ? run.scale ?? run.party : run.party;
    const limit = size != null ? challengeSeconds(run.raid, run.mode, size) : null;
    if (limit == null) return no('no challenge time for this run');
    if (run.sec == null) return no('the clear time was not seen');
    if (run.sec > limit) return no(`${clockWords(run.sec)}, the challenge time is ${clockWords(limit)}`);
  }
  return { ok: true };
}

/** The tile-wide rules a run must also pass (deaths, teammates). Start counts are judged elsewhere. */
export function runPassesTileRules(c: TileConditions, run: RaidRun): { ok: true } | Refusal {
  if (c.noDeaths) {
    if (run.deaths == null) return no('deaths were not tracked for this raid');
    if (run.deaths > 0) return no(`${run.deaths} death${run.deaths === 1 ? '' : 's'} in the party`);
  }
  if (c.mates && 'all' in c.mates) {
    if (!run.allMates) return no('not everyone in the raid was on the team');
  } else if (c.mates) {
    if (run.mates == null) return no('teammates were not seen');
    if (run.mates < c.mates.min) return no(`${run.mates} of the team inside, needs ${c.mates.min}`);
  }
  return { ok: true };
}

/** A raid tile's verdict on one clear: the first pick that takes it, or why none did. */
export function judgeRaidRun(c: TileConditions, run: RaidRun): Verdict {
  const picks = (c.raids ?? []).filter((p) => p.raid === run.raid);
  if (picks.length === 0) return no('this raid is not on the tile');
  let first: Refusal | null = null;
  for (const pick of picks) {
    const r = pickAccepts(pick, run);
    if (!r.ok) {
      first ??= r;
      continue;
    }
    const tile = runPassesTileRules(c, run);
    if (!tile.ok) return tile;
    return { ok: true, pick };
  }
  return first!;
}

/** The player's count when the event started vs the bar. Null start = unknown: allowed, the clear's own count line decides. */
export function startCountAllows(bar: StartCount, startCount: number | null): boolean {
  if (startCount == null) return true;
  return bar.op === 'lt' ? startCount < bar.n : startCount > bar.n;
}

/**
 * Proof from the game's own count line: a clear or kill that reads `count` means they had count - 1
 * before it. "Under 1" (a first) needs the line to read 1; "over 50" needs 52 or more.
 */
export function countLineAllows(bar: StartCount, count: number): boolean {
  const before = count - 1;
  return bar.op === 'lt' ? before < bar.n : before > bar.n;
}

// ─── Words ───────────────────────────────────────────────────────────────────────────────────

const RAID_SHORT: Record<RaidId, string> = { cox: 'CoX', tob: 'ToB', toa: 'ToA', tfa: 'TFA' };

/** "CoX CM inside its challenge time" / "solo ToA at 300+" / "ToB Hard Mode, 4+ players, under 30:00". */
export function pickWords(p: RaidPick): string {
  const parts: string[] = [];
  let name = RAID_SHORT[p.raid];
  if (p.raid === 'toa') {
    const bar = p.toa ?? { min: 150, entry: false };
    name += ` at ${bar.min}+${bar.entry ? ' or Entry' : ''}`;
  } else if (p.modes?.length) {
    const ms = p.modes.map((m) => (m === 'cm' ? 'CM' : m === 'hard' ? 'HM' : m === 'entry' ? 'Entry' : 'Normal'));
    if (!(ms.length === 1 && ms[0] === 'Normal')) name += ` ${ms.join('/')}`;
  }
  if (p.party?.op === 'eq' && p.party.n <= 3) name = `${partyWords(p.party)} ${name}`;
  else if (p.party) parts.push(partyWords(p.party));
  if (p.scale && p.raid === 'cox') parts.push(`scaled to ${p.scale}+`);
  if (p.under != null) parts.push(`under ${clockWords(p.under)}`);
  if (p.challenge) parts.push('inside its challenge time');
  return [name, ...parts].join(', ');
}

/** One sentence for the whole tile's conditions (after "Clear N of: "). */
export function conditionsSentence(c: TileConditions): string {
  const raids = (c.raids ?? []).map(pickWords);
  const lead = raids.length <= 1 ? raids.join('') : `${raids.slice(0, -1).join('; ')} or ${raids[raids.length - 1]}`;
  const tail: string[] = [];
  if (c.noDeaths) tail.push('Nobody can die.');
  if (c.mates && 'all' in c.mates) tail.push('Everyone inside on the team.');
  else if (c.mates) tail.push(`At least ${c.mates.min} of the team inside${c.shared === 'together' ? ', counted once per raid' : ''}.`);
  if (c.startCount) tail.push(c.startCount.op === 'lt' ? (c.startCount.n === 1 ? 'First-timers only.' : `Only players under ${c.startCount.n} at the start.`) : `Only players over ${c.startCount.n} at the start.`);
  return [lead + (lead ? '.' : ''), ...tail].filter(Boolean).join(' ');
}

/** Parsed from the tile column; null when absent or unreadable. Never throws. */
export function parseConditions(raw: unknown): TileConditions | null {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object' || (v as { v?: unknown }).v !== 1) return null;
  return v as TileConditions;
}

/** True when the tile needs the plugin's `raid` fact to be judged (any raid pick or tile-wide raid rule). */
export function needsRaidFacts(c: TileConditions | null): boolean {
  return !!c && (c.raids?.length ?? 0) > 0;
}
