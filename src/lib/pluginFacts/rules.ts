/**
 * The rule table a plugin with capability `rules` runs on (GET /api/plugin/rules).
 *
 * It tells the client only what it must decide ON THE SPOT: what deserves a screenshot (the frame is
 * gone by the time the site could answer) and what to say in chat right away. Which tile a fact
 * credits, and by how much, is the site's (lib/pluginFacts/match); a rule's `have`/`of` is just the
 * client's starting point for its instant chat line, corrected by every facts reply.
 *
 * Built from the exact config the plugin tracks (the config route's body), so the two never disagree.
 */
import { statKeys } from '@/lib/tileKinds';
import { kcNamesForKey } from '@/lib/pluginStats';
import { killTargetKeys, type DropTile, type KillTile, type PlainTile, type ValueTile } from '@/lib/pluginFacts/match';
import { parseTrialRankTile } from '@/lib/barracudaTrials';
import { DIARY_AREAS } from '@/lib/constants';

export interface StatTileIn {
  tileId: number;
  label: string;
  statName: string;
  statType: 'skill' | 'boss' | 'kc' | string;
  currentAmount: number;
  goalAmount: number;
  partOf?: number | null;
}

export interface RulesConfigIn {
  trackedDrops?: (DropTile & { partOf?: number | null })[] | null;
  trackedKills?: KillTile[] | null;
  trackedValues?: ValueTile[] | null;
  trackedStats?: StatTileIn[] | null;
  completedTiles?: { tileId: number }[] | null;
  trackedTimed?: (PlainTile & { minRaidLevel?: number; completed?: boolean })[] | null;
  trackedDeathless?: (PlainTile & { minRaidLevel?: number; partyTeamOnly?: boolean; completed?: boolean })[] | null;
  trackedLms?: (PlainTile & { completed?: boolean })[] | null;
  trackedPvp?: (PlainTile & { targets?: string[]; minLootValue?: number })[] | null;
  pvpRoster?: { name: string; teamId: number }[] | null;
  team?: { id: number } | null;
  trackedDiaries?: (PlainTile & { diaries?: string[] })[] | null;
  trackedCombatTasks?: (PlainTile & { tasks?: string[]; counted?: string[] })[] | null;
  trackedClog?: (PlainTile & { mode?: string; items?: string[] | null; groups?: Record<string, number[]>; completed?: boolean; proven?: boolean })[] | null;
  trackedGains?: (PlainTile & { itemIds?: number[]; completed?: boolean })[] | null;
  trackedCombos?: { tileId: number; label: string }[] | null;
}

/**
 * A tile the plugin judges on the spot (timed, deathless, LMS, PvP, diary, combat task, clog, gain):
 * the event `on` must name one of `keys` (absent = any; "*" = any), already expanded here so the
 * client only checks equality — except timed/deathless, whose key is the activity the client's clear
 * parser matches. The client counts it (`of` 0 = never counted: a one-clear timed tile, a whole-page
 * clog tile), says `say` (a template key, default `on`) and sends the `tile` fact.
 */
export interface EventRule {
  t: number;
  label: string;
  have: number;
  of: number;
  on: 'timed' | 'deathless' | 'lms' | 'pvp' | 'pvpLoot' | 'diary' | 'ca' | 'clog' | 'page' | 'gain';
  keys?: string[];
  /** Keys that never hit, even through a wildcard: a combat task already counted on the tile. */
  no?: string[];
  /** The event's value must be at most this: a clear's seconds, the deaths in a run (0), an LMS place. */
  max?: number;
  /** ...and at least this: a PvP kill's loot (gp). */
  min?: number;
  /** Exact party size (0 = any). */
  party?: number;
  /** ToA: the raid level the run must end at. */
  lvl?: number;
  /** Every player in the raid must be on the team. */
  team?: boolean;
  coop?: boolean;
  /** A clog page: item ids that must all be obtained on the open page. */
  need?: number[];
  say?: string;
}

export interface DropRule {
  t: number;
  label: string;
  have: number;
  of: number;
  /** Accepted source kinds; absent = anything but PvP. */
  src?: string[];
  /** Loot source names that count (wiki-named; the client compares without the "(qualifier)"). */
  npcs?: string[];
  /** The client may count this tile itself for its chat line: one item = one credit, capped at `of`. */
  simple: boolean;
}

export interface KillRule {
  t: number;
  label: string;
  have: number;
  of: number;
  unit: string;
  /** A cap counter: counted, never a chat line. */
  quiet?: boolean;
  /** Attach the client's view of its company (shared-kill credit). */
  coop?: boolean;
}

export interface ValueRule {
  t: number;
  label: string;
  /** A single haul at least this big counts; 0 for a running-total tile (every haul counts). */
  min: number;
  have: number;
  of: number;
  src?: string[];
}

export interface StatRule {
  t: number;
  label: string;
  /** "xp" (skill) or "kc" (boss / activity count). */
  on: 'xp' | 'kc';
  /** The game names that feed it (a composite tile lists several), as {@link statRuleName} spells them. */
  names: string[];
  have: number;
  of: number;
  /** Chat line every `step` gained; 0 = completion only (a small requirement). */
  step: number;
  /** XP only: announce a step only with gains in ≥ active[0] distinct minutes of the last active[1]. */
  active?: [number, number];
}

export interface RuleTable {
  v: 1;
  /** item id → drop rules (any hit is screenshot-worthy). */
  drops: Record<string, DropRule[]>;
  /** lowercase kill-target key → kill rules. */
  kills: Record<string, KillRule[]>;
  values: ValueRule[];
  stats: StatRule[];
  /** Kill proof policy: tiles with `of` ≥ min screenshot only on `frac` steps (and completion). */
  proof: { min: number; frac: number };
  /** Chat templates; {label} {have} {of} {unit} {pct} are filled in by the client. */
  say: Record<string, string>;
  /** Every drop tile is done (and there is at least one): the client stops counting item gains. */
  blackout: boolean;
  events: EventRule[];
}

/** Where a sustained-activity gate sits for XP lines: gains in 5 distinct minutes of the last 10. */
export const XP_ACTIVE: [number, number] = [5, 10];

/**
 * About a tenth of the requirement, rounded to a clean number (1 / 2 / 2.5 / 5 × a power of ten).
 * Small requirements announce completion only: under 10 for counts, under 10k for XP.
 */
export function statStep(of: number, on: 'xp' | 'kc'): number {
  if (!(of > 0) || of < (on === 'xp' ? 10_000 : 10)) return 0;
  const raw = of / 10;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const nice = m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.75 ? 2.5 : m < 7.5 ? 5 : 10;
  return Math.max(1, Math.round(nice * p));
}

/** A stat name reduced to lowercase letters and digits ("Kree'Arra", "kree arra" → "kreearra"); the plugin folds the KC line / skill the same way. */
export function statRuleName(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** An RSN as the client compares it: lowercase, space/underscore runs as one space. */
function rsnKey(n: string): string {
  return n.replace(/[\s_]+/g, ' ').trim().toLowerCase();
}

/** Diary selectors ("Ardougne Elite", "Any Elite", "Lumbridge Any") as "<area> <tier>" keys, "*" either side for Any; an area matches every diary area containing it. */
export function diaryKeys(selectors: string[]): string[] {
  const out = new Set<string>();
  for (const sel of selectors) {
    const s = sel?.trim() ?? '';
    const cut = s.lastIndexOf(' ');
    if (cut <= 0) continue;
    const area = s.slice(0, cut).trim().toLowerCase();
    const tier = s.slice(cut + 1).trim().toLowerCase();
    const tierKey = tier === 'any' ? '*' : statRuleName(tier);
    const areas = area === 'any' ? ['*'] : [area, ...DIARY_AREAS.map((a) => a.toLowerCase()).filter((a) => a.includes(area))].map(statRuleName);
    for (const a of areas) out.add(`${a} ${tierKey}`);
  }
  return [...out];
}

/** PvP selectors as RSN keys: "any" → "*", "team:other" → every rival on the roster, "rsn:<name>" → that name. */
export function pvpKeys(targets: string[], roster: { name: string; teamId: number }[], myTeam: number | null | undefined): string[] {
  const out = new Set<string>();
  for (const sel of targets) {
    const s = sel?.trim() ?? '';
    if (s.toLowerCase() === 'any') out.add('*');
    else if (s.toLowerCase() === 'team:other') {
      if (myTeam != null) for (const r of roster) if (r?.name && r.teamId !== myTeam) out.add(rsnKey(r.name));
    } else if (s.toLowerCase().startsWith('rsn:')) out.add(rsnKey(s.slice(4)));
  }
  out.delete('');
  return [...out];
}

/** The event rules for the tiles the plugin judges itself, open ones only. */
export function buildEventRules(cfg: RulesConfigIn): EventRule[] {
  const done = new Set((cfg.completedTiles ?? []).map((c) => c.tileId));
  const combo = new Map((cfg.trackedCombos ?? []).map((c) => [c.tileId, c.label]));
  const open = (r: PlainTile & { completed?: boolean }) => !r.completed && !done.has(r.tileId) && (r.currentAmount ?? 0) < Math.max(1, r.requiredAmount ?? 1);
  const base = (r: PlainTile, on: EventRule['on']): EventRule => ({ t: r.tileId, label: r.label, have: r.currentAmount ?? 0, of: Math.max(1, r.requiredAmount ?? 1), on });
  const out: EventRule[] = [];
  for (const r of cfg.trackedTimed ?? []) {
    if (r.completed || done.has(r.tileId) || !r.activity) continue;
    // A Barracuda Trials rank tile wants the exact course and rank, no cap or party; it may count runs.
    const trial = !!parseTrialRankTile(r.activity);
    const runs = trial ? Math.max(1, r.requiredAmount ?? 1) : 1;
    out.push({
      ...base(r, 'timed'),
      have: runs > 1 ? r.currentAmount ?? 0 : 0,
      of: runs > 1 ? runs : 0,
      keys: [r.activity],
      ...(trial ? {} : { max: r.thresholdSeconds ?? 0, party: r.partySize ?? 0 }),
      lvl: r.minRaidLevel ?? 0,
      ...(runs > 1 ? { say: 'timedRuns' } : {}),
    });
  }
  for (const r of cfg.trackedDeathless ?? []) {
    if (!open(r) || !r.activity) continue;
    out.push({
      ...base(r, 'deathless'),
      keys: [r.activity],
      max: 0,
      party: r.partySize ?? 0,
      lvl: r.minRaidLevel ?? 0,
      ...(r.partyTeamOnly ? { team: true } : {}),
      ...((r.coopCredit ?? '').toLowerCase() === 'per-kill' || (r.coopMinMembers ?? 0) > 0 ? { coop: true } : {}),
    });
  }
  for (const r of cfg.trackedLms ?? []) {
    if (r.completed || done.has(r.tileId)) continue;
    out.push({ ...base(r, 'lms'), max: Math.max(1, r.placementCap ?? 1) });
  }
  for (const r of cfg.trackedPvp ?? []) {
    const keys = pvpKeys(r.targets ?? [], cfg.pvpRoster ?? [], cfg.team?.id);
    if (!open(r) || keys.length === 0) continue;
    const min = r.minLootValue ?? 0;
    out.push({ ...base(r, min > 0 ? 'pvpLoot' : 'pvp'), keys, ...(min > 0 ? { min } : {}) });
  }
  for (const r of cfg.trackedDiaries ?? []) {
    const keys = diaryKeys(r.diaries ?? []);
    if (open(r) && keys.length) out.push({ ...base(r, 'diary'), keys });
  }
  for (const r of cfg.trackedCombatTasks ?? []) {
    const no = r.counted ?? [];
    const keys = [...new Set((r.tasks ?? []).map((s) => statRuleName(s ?? '')).filter((k) => k && !no.includes(k)))];
    if (open(r) && keys.length) out.push({ ...base(r, 'ca'), keys, ...(no.length ? { no } : {}) });
  }
  for (const r of cfg.trackedClog ?? []) {
    if (r.completed || done.has(r.tileId)) continue;
    const label = r.partOf && combo.has(r.partOf) ? `${combo.get(r.partOf)!.trim()} \u2014 ${r.label.trim()}` : r.label;
    const keys = r.items == null ? ['*'] : [...new Set(r.items.map(statRuleName).filter(Boolean))];
    if (r.mode === 'complete') {
      // A whole-page tile takes slots on its pages uncounted, and waits for a screenshot of each finished page.
      out.push({ ...base(r, 'clog'), label, have: 0, of: 0, keys, say: 'clog0' });
      // The caller's page proof is live: nothing more to capture (a deleted one brings the pages back).
      for (const [page, ids] of r.proven ? [] : Object.entries(r.groups ?? {})) {
        if (ids?.length) out.push({ ...base(r, 'page'), label, have: 0, of: 0, keys: [page], need: ids });
      }
    } else if (open(r)) out.push({ ...base(r, 'clog'), label, keys });
  }
  for (const r of cfg.trackedGains ?? []) {
    if (open(r) && r.itemIds?.length) out.push({ ...base(r, 'gain'), keys: r.itemIds.map(String) });
  }
  return out;
}

/**
 * Another board's row (tagged by lib/pluginBoardTiles) says which board in its chat line, so one drop
 * on two boards reads as two lines that can be told apart. Plugin-judged kinds arrive suffixed already.
 */
export function named(r: { label: string; board?: unknown }): string {
  const name = (r.board as { name?: string } | null | undefined)?.name;
  return name && !r.label.endsWith(` \u00b7 ${name}`) ? `${r.label} \u00b7 ${name}` : r.label;
}

function isSimpleDrop(d: DropTile): boolean {
  return !d.itemRequirements?.length && d.countMode !== 'distinct' && !(d.perKillCap ?? 0) && !(d.partySize ?? 0);
}


export function buildRuleTable(cfg: RulesConfigIn): RuleTable {
  const done = new Set((cfg.completedTiles ?? []).map((c) => c.tileId));
  const drops: Record<string, DropRule[]> = {};
  for (const d of cfg.trackedDrops ?? []) {
    const perItem = !!d.itemRequirements?.length;
    if (perItem ? done.has(d.tileId) : d.currentAmount >= d.requiredAmount) continue;
    const ids = perItem ? d.itemRequirements!.map((r) => r.itemId) : d.itemIds ?? [];
    const rule: DropRule = {
      t: d.tileId,
      label: named(d),
      have: d.currentAmount,
      of: d.requiredAmount,
      simple: isSimpleDrop(d),
      ...(d.acceptedSources?.length ? { src: d.acceptedSources } : {}),
      ...(d.sourceNpcs?.length ? { npcs: d.sourceNpcs } : {}),
    };
    for (const id of new Set(ids)) (drops[id] ??= []).push(rule);
  }

  const kills: Record<string, KillRule[]> = {};
  for (const k of cfg.trackedKills ?? []) {
    if (k.currentAmount >= k.requiredAmount) continue;
    const cap = k.capOf != null && k.capOf > 0;
    if (cap && done.has(k.capOf!)) continue;
    const rule: KillRule = {
      t: k.tileId,
      label: named(k),
      have: k.currentAmount,
      of: k.requiredAmount,
      unit: k.unit?.trim() || 'kill',
      ...(cap ? { quiet: true } : {}),
      ...((k.coopCredit ?? '').toLowerCase() === 'per-kill' || (k.coopMinMembers ?? 0) > 0 ? { coop: true } : {}),
    };
    for (const target of k.targetNpcs ?? []) {
      for (const key of killTargetKeys(target)) if (!(kills[key] ??= []).includes(rule)) kills[key].push(rule);
    }
  }

  const values: ValueRule[] = (cfg.trackedValues ?? [])
    .filter((v) => !v.completed)
    .map((v) => {
      const total = (v.mode ?? '').toLowerCase() === 'total';
      return {
        t: v.tileId,
        label: named(v),
        min: total ? 0 : v.thresholdGp,
        have: total ? Math.min(v.currentGp ?? 0, v.thresholdGp) : 0,
        of: v.thresholdGp,
        ...(v.sources?.length ? { src: v.sources } : {}),
      };
    });

  const stats: StatRule[] = [];
  for (const s of cfg.trackedStats ?? []) {
    if (done.has(s.tileId) || !(s.goalAmount > 0) || s.currentAmount >= s.goalAmount) continue;
    const on: 'xp' | 'kc' = s.statType === 'skill' ? 'xp' : 'kc';
    // A composite tile lists several keys; a boss key answers to every name its KC line can carry.
    const keys = statKeys(s.statName);
    const names = (on === 'kc' ? keys.flatMap((k) => { const n = kcNamesForKey(k); return n.length ? n : [k]; }) : keys)
      .map(statRuleName)
      .filter(Boolean);
    if (names.length === 0) continue;
    stats.push({
      t: s.tileId,
      label: s.label,
      on,
      names: [...new Set(names)],
      have: s.currentAmount,
      of: s.goalAmount,
      step: statStep(s.goalAmount, on),
      ...(on === 'xp' ? { active: XP_ACTIVE } : {}),
    });
  }

  const allDrops = cfg.trackedDrops ?? [];
  return {
    v: 1,
    blackout: allDrops.length > 0 && allDrops.every((d) => d.currentAmount >= d.requiredAmount),
    drops,
    kills,
    values,
    stats,
    events: buildEventRules(cfg),
    proof: { min: 25, frac: 0.25 },
    say: {
      drop: 'Tracked drop: {label} ({have}/{of})',
      dropPlain: 'Tracked drop: {label}',
      kill: 'Tracked {unit}: {label} ({have}/{of})',
      value: 'Loot worth {gp} counted: {label}',
      xp: '{label}: {have}/{of} xp ({pct}%)',
      kc: '{label}: {have}/{of} ({pct}%)',
      done: 'Tile complete: {label}!',
      timed: 'Tracked timed clear: {label} in {x}',
      timedRuns: 'Tracked timed clear: {label} in {x} ({have}/{of} runs)',
      deathless: 'Tracked deathless run: {label} ({have}/{of})',
      'deathless.max': 'Not deathless: {label} \u2014 {x} this run.',
      'deathless.party': 'Deathless run not counted for {label}: party of {seen}, tile requires {party}.',
      'deathless.team': 'Deathless run not counted for {label}: {why}.',
      lms: 'Tracked LMS placement: {x} \u2014 {label}',
      clog: 'Collection log: +1 slot for {label} ({have}/{of})',
      clog0: 'Collection log: +1 slot for {label}',
      gain: 'Tracking gains: {label} ({have}/{of})',
    },
  };
}
