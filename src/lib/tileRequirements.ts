import { GAME_COUNTERS } from '@/lib/gameCounters';
import { parseTrialRankTile } from '@/lib/barracudaTrials';
import { isManualOnlyDropTile } from '@/lib/clogManual';
import { clogTileMode } from '@/lib/clogTileWords';
import { COMBO_TILE_TYPE, parseComboRule, type ComboRule } from '@/lib/combo';
import { lapUnitNoun } from '@/lib/constants';
import { DEFAULT_PING_MAX, tilePingMax } from '@/lib/pingMax';
import { PET_GROUPS } from '@/lib/petGroups';
import { isIndividualMode } from '@/lib/statTracking';
import { isGotrEnergyCapped, parseCapBy } from '@/lib/tileCaps';
import { parseJsonArray, statLabel, tileKindKey, type TileKindKey } from '@/lib/tileKinds';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// "Before you start": what a tile needs from a player, and what it can't do.
//
// ONE registry, three readers:
//   - the member tile viewer (components/TileBeforeYouStart) — the tile's own list, combos per part;
//   - the admin editor and the tile creator's confirm step — the same list, compact, so whoever
//     builds the board sees what players will need;
//   - the public guide page /guide/tiles — every entry, grouped, each under its own stable anchor
//     (the entry id), which is what the viewer's "Why?" links point at.
//
// Each entry may name a per-player CHECK the server can run for the viewing player (lib/tileReadiness:
// "you haven't synced your collection log", "your plugin is too old"). The registry only names it;
// the data lives server-side, so this module stays pure and client-safe — no database, no clog
// catalogue.
//
// Wording: plain and short, said to the player. Rules here are the ones the code enforces — when a
// rule changes in its own module (lib/clogTiles, lib/tileCaps, lib/pingMax, lib/combo, …), change
// its sentence here too.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Per-player checks lib/tileReadiness knows how to run. */
export type NeedCheck = 'plugin-seen' | 'plugin-version' | 'clog-synced' | 'clog-owned' | 'hiscores-ranked';

export type NeedKind = 'requirement' | 'limitation';

export type NeedGroup = 'plugin' | 'clog' | 'combo' | 'counts' | 'hiscores' | 'raids' | 'screenshots';

/** Guide sections, in page order. Titles are English: the entries are (see app/guide _pages/TilesGuide). */
export const NEED_GROUPS: { key: NeedGroup; title: string }[] = [
  { key: 'plugin', title: 'The plugin' },
  { key: 'clog', title: 'Collection log tiles' },
  { key: 'combo', title: 'Combo tiles' },
  { key: 'counts', title: 'Counts and counters' },
  { key: 'hiscores', title: 'Hiscores tiles' },
  { key: 'raids', title: 'Raids and timed runs' },
  { key: 'screenshots', title: 'Things the plugin can’t see' },
];

/**
 * The first plugin build that screenshots collection-log tiles (each new slot, and a finished page
 * opened in game). Older builds still credit slots off the same chat line when "Sync collection log"
 * is on, but a finished tile then waits for an uploaded screenshot.
 */
export const CLOG_TILE_MIN_PLUGIN = '1.14.0';

interface NeedDef {
  kind: NeedKind;
  group: NeedGroup;
  /** Guide heading. */
  title: string;
  /** The line on the tile — and the guide's first sentence. */
  text: string;
  /** Extra guide-only explanation. */
  more?: string;
  check?: NeedCheck;
}

const DEFS = {
  // ── The plugin ──
  'plugin-running': {
    kind: 'requirement', group: 'plugin', title: 'Run the plugin while you play',
    text: 'Run the Anvil plugin in RuneLite while you play.',
    more: 'Plugin tiles only see what happens while the plugin is running and signed in. If it missed something, upload a screenshot on the tile instead.',
    check: 'plugin-seen',
  },

  // ── Collection log ──
  'clog-chat-setting': {
    kind: 'requirement', group: 'clog', title: 'Turn on the new-addition message',
    text: 'Turn on Settings → Chat → “Collection log - New addition notification”. The plugin counts slots from that message.',
    more: 'The game prints “New item added to your collection log” once per item, ever. With the setting off there is nothing for the plugin to read.',
  },
  'clog-plugin-version': {
    kind: 'requirement', group: 'clog', title: 'Plugin version for collection log tiles',
    text: `Run the Anvil plugin (${CLOG_TILE_MIN_PLUGIN} or newer) while you play.`,
    more: 'Older plugin versions still count slots from the same message if “Sync collection log” is on, but the tile won’t complete until someone uploads a screenshot.',
    check: 'plugin-version',
  },
  'clog-first-time': {
    kind: 'limitation', group: 'clog', title: 'Only first-time unlocks count',
    text: 'Only first-time unlocks count. Items already in your log and repeat drops never count.',
    more: 'Sync your collection log in the plugin and the tile can tell you which of its items you already have.',
    check: 'clog-owned',
  },
  'clog-screenshot': {
    kind: 'requirement', group: 'clog', title: 'A finished tile needs a screenshot',
    text: 'A completed tile needs a screenshot. The plugin takes one with each new slot; otherwise upload a screenshot of the “New item added” message.',
  },
  'clog-sync-before': {
    kind: 'requirement', group: 'clog', title: 'Sync your log before the event',
    text: 'Sync your collection log in the plugin before the event starts.',
    more: 'Whole-page tiles count the slots you already had, so the site needs your log as it was at the start.',
    check: 'clog-synced',
  },
  'clog-page-screenshot': {
    kind: 'requirement', group: 'clog', title: 'Screenshot the finished page',
    text: 'When you finish the page, open it in game with the plugin running so it can screenshot it, or upload one.',
  },
  'clog-page-own-log': {
    kind: 'limitation', group: 'clog', title: 'One log, finished during the event',
    text: 'A page finished before the event doesn’t count, and one player must fill the whole page in their own log.',
    check: 'clog-owned',
  },
  'clog-sync-only': {
    kind: 'limitation', group: 'clog', title: 'Sync-only slots get checked',
    text: 'Slots that only show up in a log sync, without the in-game message, are marked for staff to check.',
  },

  // ── Combo ──
  'combo-part-rules': {
    kind: 'requirement', group: 'combo', title: 'Every part keeps its own rules',
    text: 'Every part follows its own rules: hiscores parts need you ranked, and plugin parts need the plugin.',
  },
  'combo-whole-part': {
    kind: 'limitation', group: 'combo', title: 'Parts count when they’re done',
    text: 'A part counts only once it’s fully done.',
    more: 'This is how “any one”, “all of them” and “at least N” combos work. Mix-and-match combos are the exception.',
  },
  'combo-mix-share': {
    kind: 'limitation', group: 'combo', title: 'Mix and match: each part adds its share',
    text: 'Each part adds its share. Going over on one part never counts past its share. Single clears, single hauls and diary tiers are all-or-nothing.',
  },
  'combo-solo': {
    kind: 'limitation', group: 'combo', title: 'Solo combos',
    text: 'One player must meet the rule alone. A part finished by the team as a whole counts for everyone.',
  },
  'combo-locked': {
    kind: 'limitation', group: 'combo', title: 'Parts are fixed at the start',
    text: 'Parts are locked once the event starts.',
  },

  // ── Counts and counters ──
  'count-only-cap': {
    kind: 'limitation', group: 'counts', title: 'Counts without a screenshot',
    text: `A count the plugin sends without a screenshot credits at most ${DEFAULT_PING_MAX} at once. Anything bigger is flagged for staff.`,
    more: 'Counters that jump in bigger steps (a Wintertodt round, a Giants’ Foundry sword) allow one game’s worth at once instead.',
  },
  'unverified-counter': {
    kind: 'limitation', group: 'counts', title: 'New counters are checked by staff',
    text: 'This counter is new: it counts, but staff check its credits until it has been confirmed in game.',
  },
  'slayer-masters': {
    kind: 'limitation', group: 'counts', title: 'Slayer tasks by master',
    text: 'Only Mortimer and Krystilia tasks can be told apart. Every other master’s tasks count as “other masters” or “any master”.',
  },
  'gotr-plugin': {
    kind: 'requirement', group: 'counts', title: 'GOTR searches need the plugin in the minigame',
    text: 'The plugin must be running in GOTR, both for the searches (“You found some loot:”) and for the energy line at the end of each game.',
    check: 'plugin-seen',
  },
  'gotr-energy': {
    kind: 'limitation', group: 'counts', title: 'Searches paid for with event energy',
    text: 'Searches only count up to the elemental and catalytic energy you attuned during this event. Banked or teammates’ energy doesn’t count.',
  },
  'gotr-old-plugin': {
    kind: 'limitation', group: 'counts', title: 'Older plugins and energy-capped tiles',
    text: 'Older plugin builds credit correctly but show extra rows.',
  },
  'counter-cap': {
    kind: 'limitation', group: 'counts', title: 'Capped counts',
    text: 'This count is capped by other counters you earn during the event. One player’s spare never covers another’s.',
  },
  'lap-counter': {
    kind: 'requirement', group: 'counts', title: 'Turn the lap counter on',
    text: 'Turn the lap counter on: right-click Grace in the Rogues’ Den and pick Toggle Counter. Laps only count when the game prints your lap count.',
  },
  'dt2-awakened-loot': {
    kind: 'limitation', group: 'counts', title: 'Normal and awakened DT2 bosses',
    text: 'Awakened fights name the boss the same as normal ones in their loot, so loot from an awakened kill can count toward a normal-boss tile.',
  },

  // ── Hiscores ──
  'hiscores-ranked': {
    kind: 'requirement', group: 'hiscores', title: 'Be ranked on the hiscores',
    text: 'Be ranked on the hiscores for this skill or boss.',
    more: 'Skills only show for the top two million; bosses and activities only after a minimum count. Progress you make while unranked isn’t seen.',
    check: 'hiscores-ranked',
  },
  'hiscores-lag': {
    kind: 'limitation', group: 'hiscores', title: 'Hiscores progress lags',
    text: 'Progress comes from the hiscores, so it can show up a while after you play. Running the plugin makes it show sooner.',
  },
  'hiscores-baseline': {
    kind: 'limitation', group: 'hiscores', title: 'Only gains after the start count',
    text: 'Your stats are recorded when the event starts. Only what you gain after that counts.',
  },

  // ── Raids and timed runs ──
  'raid-party-size': {
    kind: 'requirement', group: 'raids', title: 'Exact party size',
    text: 'Your group must be exactly the party size the tile asks for.',
  },
  'raid-team-only': {
    kind: 'requirement', group: 'raids', title: 'Team-only raids',
    text: 'Everyone in the raid must be on your team.',
  },
  'raid-min-level': {
    kind: 'requirement', group: 'raids', title: 'Minimum raid level',
    text: 'The raid must end at the raid level the tile asks for or higher.',
  },
  'trial-runs': {
    kind: 'limitation', group: 'raids', title: 'Barracuda rank tiles count runs',
    text: 'This tile counts runs: each run that reaches the rank adds one.',
  },

  // ── Things the plugin can't see ──
  'manual-only-items': {
    kind: 'requirement', group: 'screenshots', title: 'Bought, made or handed-over items',
    text: 'The plugin can’t see these items arrive (they’re bought, made or handed over). It only catches the one-time collection log message, so if you already own one, upload a screenshot.',
  },
  'pet-duplicate': {
    kind: 'limitation', group: 'screenshots', title: 'Pets you already own',
    text: 'A new pet counts by itself. A pet you already own (“would have been followed”) needs a screenshot upload.',
  },
  'champion-scroll': {
    kind: 'limitation', group: 'screenshots', title: 'Duplicate champion scrolls',
    text: 'A duplicate champion scroll’s message doesn’t say which scroll it was, so it needs a screenshot upload.',
  },
} satisfies Record<string, NeedDef>;

export type NeedId = keyof typeof DEFS;

/** One line on one tile: the registry entry, its text worded for this tile. */
export interface TileNeed {
  id: NeedId;
  kind: NeedKind;
  text: string;
  /** Anchor on /guide/tiles — always the entry id. */
  anchor: NeedId;
  check?: NeedCheck;
}

export interface TileNeeds {
  requirements: TileNeed[];
  limitations: TileNeed[];
  /** A combo's parts, each with its own list. */
  parts?: { id?: number; label: string; needs: TileNeeds }[];
}

/** Every guide entry, for /guide/tiles. */
export interface GuideNeedEntry {
  id: NeedId;
  kind: NeedKind;
  group: NeedGroup;
  title: string;
  text: string;
  more?: string;
  check?: NeedCheck;
}

export const GUIDE_NEED_ENTRIES: GuideNeedEntry[] = (Object.entries(DEFS) as [NeedId, NeedDef][]).map(([id, d]) => ({
  id,
  kind: d.kind,
  group: d.group,
  title: d.title,
  text: d.text,
  ...(d.more ? { more: d.more } : {}),
  ...(d.check ? { check: d.check } : {}),
}));

/** The guide link for an entry. English page; the anchor is the same in every language. */
export function tileNeedHref(id: NeedId): string {
  return `/guide/tiles#${id}`;
}

// ─── Reading a tile ────────────────────────────────────────────────────────────────────────────

/** Stored rows (JSON text) and editor configs (arrays) both read. */
export interface TileNeedsLike {
  id?: number;
  label?: string | null;
  tileType?: string | null;
  trackedStat?: string | null;
  statType?: string | null;
  statBasis?: string | null;
  trackingMode?: string | null;
  autoTrackDisabled?: number | boolean | null;
  itemRequirements?: string | unknown[] | null;
  trackedItemIds?: string | number[] | null;
  targetNpcs?: string | string[] | null;
  sourceNpcs?: string | string[] | null;
  countMode?: string | null;
  capBy?: string | string[] | null;
  timedActivity?: string | null;
  timeThresholdSeconds?: number | null;
  partySize?: number | null;
  minRaidLevel?: number | null;
  partyTeamOnly?: number | boolean | null;
  comboRule?: string | ComboRule | null;
  parts?: TileNeedsLike[] | null;
}

const PET_IDS: ReadonlySet<number> = new Set(PET_GROUPS.find((g) => g.key === 'all')?.items.map((i) => i.id) ?? []);
/** Earth warrior … Zombie champion scroll (the cape is not a scroll). */
const CHAMPION_SCROLL_IDS: ReadonlySet<number> = new Set([6798, 6799, 6800, 6801, 6802, 6803, 6804, 6805, 6806, 6807]);
/** The normal DT2 bosses as kill targets / drop sources ("Vardorvis (awakened)" is its own counter). */
const DT2_NORMAL = new Set(['duke sucellus', 'vardorvis', 'the leviathan', 'leviathan', 'the whisperer', 'whisperer']);
const UNCONFIRMED_COUNTERS = new Map(GAME_COUNTERS.filter((c) => !c.confirmed).map((c) => [c.name.toLowerCase(), c.name]));

const PLUGIN_KINDS: ReadonlySet<TileKindKey> = new Set(['drop', 'collection', 'kill', 'lap', 'pvp', 'gain', 'timed', 'deathless', 'lms', 'value', 'diary', 'ca']);
const PING_KINDS: ReadonlySet<TileKindKey> = new Set(['kill', 'lap', 'pvp', 'gain', 'lms']);

function need(id: NeedId, text?: string): TileNeed {
  const d: NeedDef = DEFS[id];
  return { id, kind: d.kind, text: text ?? d.text, anchor: id, ...(d.check ? { check: d.check } : {}) };
}

function itemIdsOf(tile: TileNeedsLike): number[] {
  const ids = parseJsonArray<number>(tile.trackedItemIds ?? null).map(Number);
  const reqs = Array.isArray(tile.itemRequirements) ? tile.itemRequirements : parseJsonArray<unknown>(tile.itemRequirements ?? null);
  for (const r of reqs) {
    const id = Number((r as { itemId?: unknown })?.itemId);
    if (Number.isInteger(id)) ids.push(id);
  }
  return ids;
}

function kindOf(tile: TileNeedsLike): TileKindKey {
  const reqs = tile.itemRequirements;
  return tileKindKey({
    tileType: tile.tileType ?? 'standard',
    trackedStat: tile.trackedStat ?? null,
    statType: tile.statType ?? null,
    itemRequirements: Array.isArray(reqs) ? (reqs.length > 0 ? JSON.stringify(reqs) : null) : reqs ?? null,
    targetNpcs: tile.targetNpcs ?? null,
  });
}

const list = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * What one tile needs from a player and what it can't do. Pure: the same answer on the board, in the
 * editor and in tests. A combo lists its own rules plus each part's list.
 */
export function tileNeeds(tile: TileNeedsLike): TileNeeds {
  if (tile.tileType === COMBO_TILE_TYPE) return comboNeeds(tile);
  const req: TileNeed[] = [];
  const lim: TileNeed[] = [];
  // Completed by hand: nothing to set up, the tile says so itself.
  if (tile.autoTrackDisabled) return { requirements: req, limitations: lim };

  const kind = kindOf(tile);
  const targets = parseJsonArray<string>(tile.targetNpcs ?? null).map(String);
  const sources = parseJsonArray<string>(tile.sourceNpcs ?? null).map(String);

  if (kind === 'skill' || kind === 'boss') {
    const what = statLabel(tile.trackedStat, tile.statType);
    req.push(need('hiscores-ranked', what ? `Be ranked on the hiscores for ${what}.` : undefined));
    lim.push(need('hiscores-lag'));
    if (tile.statBasis !== 'milestone') lim.push(need('hiscores-baseline'));
    return { requirements: req, limitations: lim };
  }

  if (kind === 'clog') {
    req.push(need('clog-chat-setting'), need('clog-plugin-version'));
    if (clogTileMode(tile.countMode) === 'complete') {
      req.push(need('clog-sync-before'), need('clog-page-screenshot'));
      lim.push(need('clog-page-own-log'), need('clog-sync-only'));
    } else {
      req.push(need('clog-screenshot'));
      lim.push(need('clog-first-time'));
    }
    return { requirements: req, limitations: lim };
  }

  if ((kind === 'drop' || kind === 'collection') && isManualOnlyDropTile({ tileType: tile.tileType, trackedItemIds: tile.trackedItemIds })) {
    req.push(need('manual-only-items'));
    return { requirements: req, limitations: lim };
  }

  if (!PLUGIN_KINDS.has(kind)) return { requirements: req, limitations: lim };

  const caps = kind === 'kill' ? parseCapBy(tile.capBy) : [];
  const gotr = isGotrEnergyCapped(caps);
  req.push(need(gotr ? 'gotr-plugin' : 'plugin-running'));

  if (kind === 'lap' && lapUnitNoun(targets) === 'lap') req.push(need('lap-counter'));
  if (kind === 'timed' || kind === 'deathless') {
    // Deathless stores its party size in time_threshold_seconds (no clock on a deathless run).
    const party = kind === 'deathless' ? tile.timeThresholdSeconds : tile.partySize;
    if (party) req.push(need('raid-party-size', `Your group must be exactly ${party} player${party === 1 ? '' : 's'}.`));
    if (kind === 'deathless' && tile.partyTeamOnly) req.push(need('raid-team-only'));
    if (tile.minRaidLevel) req.push(need('raid-min-level', `The raid must end at raid level ${tile.minRaidLevel} or higher.`));
  }
  if (kind === 'timed' && parseTrialRankTile(tile.timedActivity)) lim.push(need('trial-runs'));

  if (PING_KINDS.has(kind)) {
    const max = tilePingMax(targets);
    lim.push(
      need(
        'count-only-cap',
        max != null
          ? `A count the plugin sends without a screenshot credits up to ${max.toLocaleString('en-US')} at once (one game’s worth). Anything bigger is flagged for staff.`
          : undefined,
      ),
    );
  }

  if (kind === 'kill') {
    const unverified = targets.map((t) => UNCONFIRMED_COUNTERS.get(t.trim().toLowerCase())).filter((n): n is string => !!n);
    if (unverified.length > 0) {
      lim.push(
        need(
          'unverified-counter',
          `${list(unverified)} ${unverified.length === 1 ? 'is a new counter' : 'are new counters'}: it counts, but staff check its credits until it has been confirmed in game.`,
        ),
      );
    }
    if (targets.some((t) => /^slayer tasks:/i.test(t.trim()))) lim.push(need('slayer-masters'));
    if (gotr) lim.push(need('gotr-energy'), need('gotr-old-plugin'));
    else if (caps.length > 0) {
      lim.push(need('counter-cap', `This count is capped by the ${list(caps)} you earn during the event. One player’s spare never covers another’s.`));
    }
  }

  const bosses = kind === 'kill' ? targets : kind === 'drop' || kind === 'collection' ? sources : [];
  if (bosses.some((b) => DT2_NORMAL.has(b.trim().toLowerCase()))) lim.push(need('dt2-awakened-loot'));

  if (kind === 'drop' || kind === 'collection') {
    const items = itemIdsOf(tile);
    if (items.some((id) => PET_IDS.has(id))) lim.push(need('pet-duplicate'));
    if (items.some((id) => CHAMPION_SCROLL_IDS.has(id))) lim.push(need('champion-scroll'));
  }

  return { requirements: req, limitations: lim };
}

function comboNeeds(tile: TileNeedsLike): TileNeeds {
  const rule = typeof tile.comboRule === 'object' && tile.comboRule ? tile.comboRule : parseComboRule(tile.comboRule);
  const lim: TileNeed[] = [];
  lim.push(need(rule.mode === 'mix' ? 'combo-mix-share' : 'combo-whole-part'));
  if (isIndividualMode(tile.trackingMode)) lim.push(need('combo-solo'));
  lim.push(need('combo-locked'));
  const parts = (tile.parts ?? [])
    // A combo never nests; a stray combo part reads as nothing rather than recursing.
    .filter((p) => p.tileType !== COMBO_TILE_TYPE)
    .map((p, i) => ({ ...(p.id != null ? { id: p.id } : {}), label: p.label?.trim() || `Part ${i + 1}`, needs: tileNeeds(p) }));
  return { requirements: [need('combo-part-rules')], limitations: lim, parts };
}

/** Every per-player check a tile's list (parts included) asks for. */
export function needChecks(needs: TileNeeds): NeedCheck[] {
  const out = new Set<NeedCheck>();
  const walk = (n: TileNeeds) => {
    for (const x of [...n.requirements, ...n.limitations]) if (x.check) out.add(x.check);
    for (const p of n.parts ?? []) walk(p.needs);
  };
  walk(needs);
  return [...out];
}

/** How many lines the list holds, parts included — the viewer collapses a long one. */
export function needCount(needs: TileNeeds): number {
  return needs.requirements.length + needs.limitations.length + (needs.parts ?? []).reduce((n, p) => n + needCount(p.needs), 0);
}
