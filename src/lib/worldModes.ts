// Game modes that run on their own worlds: Leagues, Deadman (permanent and seasonal), Grid Master,
// hardcore worlds, and whatever Jagex ships next.
//
// Each one is a separate save — a separate character, its own drops and kill counts — so nothing
// done there is the player's main-game progression, and its posts read as noise next to main-game
// ones. The plugin only REPORTS the world: its RuneLite type flags and the world list's activity
// line ("Grid Master", "Deadman: Annihilation", "Leagues VI"). Which mode that is gets decided here,
// so a new mode is recognised on release day without a plugin update:
//
//   1. A catalogued mode the activity or flags identify (most specific first).
//   2. Otherwise, a world carrying any flag that is NOT a known main-game flag is a mode we haven't
//      seen yet. It's named from its activity line (or the flag) and treated like any other mode —
//      routed, labelled, kept out of scoring — and the clan's Discord page lists it from then on.
//
// Pure (no db): the routes, the Discord page and the tests read it.

export interface WorldModeDef {
  key: string;
  label: string;
  /** Default thumbnail for the mode's posts (wiki path; the caller proxies it). */
  icon: string | null;
  /** Matches the world list's activity line. */
  activity?: RegExp;
  /** Matches the world's flags. */
  flags?: (types: ReadonlySet<string>) => boolean;
}

export interface WorldMode {
  key: string;
  label: string;
  icon: string | null;
  /** False for a mode named from a world we had no entry for. */
  known: boolean;
}

const WIKI = 'https://oldschool.runescape.wiki/images/';

/** Order matters: the first match wins, so the more specific entries come first. */
export const WORLD_MODES: readonly WorldModeDef[] = [
  { key: 'grid-master', label: 'Grid Master', icon: `${WIKI}Grid_Master_icon.png`, activity: /grid\s*master/i },
  {
    key: 'seasonal-deadman',
    label: 'Seasonal Deadman',
    icon: `${WIKI}Deadman_world_icon.png`,
    flags: (t) => t.has('DEADMAN') && t.has('SEASONAL'),
  },
  { key: 'deadman', label: 'Deadman', icon: `${WIKI}Deadman_world_icon.png`, activity: /deadman/i, flags: (t) => t.has('DEADMAN') },
  { key: 'leagues', label: 'Leagues', icon: `${WIKI}Leagues_icon.png`, activity: /\bleagues?\b/i, flags: (t) => t.has('SEASONAL') },
  { key: 'hardcore', label: 'Hardcore', icon: null, activity: /\bhardcore\b/i, flags: (t) => t.has('HARDCORE_MAIN') },
  { key: 'fresh-start', label: 'Fresh Start', icon: `${WIKI}Fresh_Start_Worlds_icon.png`, activity: /fresh\s*start/i, flags: (t) => t.has('FRESH_START_WORLD') },
  { key: 'tournament', label: 'Tournament', icon: `${WIKI}Tournament_world_icon.png`, flags: (t) => t.has('TOURNAMENT_WORLD') },
  { key: 'beta', label: 'Beta', icon: `${WIKI}Beta_world_icon.png`, flags: (t) => t.has('BETA_WORLD') },
];

const BY_KEY = new Map(WORLD_MODES.map((m) => [m.key, m]));
export function worldModeDef(key: string): WorldModeDef | undefined {
  return BY_KEY.get(key);
}

/**
 * Flags a main-game world can carry. Minigame worlds (PvP Arena, LMS, quest speedrunning, no-save)
 * are here too: they hand out preset accounts, have nothing worth routing, and the plugin already
 * keeps their stats out. Anything NOT in this list and not catalogued is a new mode.
 */
const MAIN_FLAGS = new Set([
  'MEMBERS',
  'PVP',
  'BOUNTY',
  'PVP_ARENA',
  'SKILL_TOTAL',
  'QUEST_SPEEDRUNNING',
  'HIGH_RISK',
  'LAST_MAN_STANDING',
  'LEGACY_ONLY',
  'EOC_ONLY',
  'NOSAVE_MODE',
]);

/** Flags RuneLite has today for separate-save worlds; every catalogued flag test uses one of these. */
const MODE_FLAGS = new Set(['SEASONAL', 'DEADMAN', 'HARDCORE_MAIN', 'TOURNAMENT_WORLD', 'BETA_WORLD', 'FRESH_START_WORLD']);

const FLAG_NAME = /^[A-Z][A-Z0-9_]{0,39}$/;

/** "DEADMAN,MEMBERS" → a set of flag names, junk dropped. */
export function parseWorldTypes(raw: unknown): Set<string> {
  if (typeof raw !== 'string') return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => FLAG_NAME.test(s))
      .slice(0, 32),
  );
}

/** The activity line, trimmed and bounded; null when blank. */
export function cleanActivity(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64);
  return s && s !== '-' ? s : null;
}

/** A stable key for a mode we named ourselves: "Deadman: Reborn II" → "deadman-reborn-ii". */
export function modeSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Strip a season counter so "Leagues V" and "Leagues VI" don't become two modes. */
function seasonless(activity: string): string {
  return activity
    .replace(/\s*[-:–(].*$/, '')
    .replace(/\s+(?:[ivxlc]+|\d+)$/i, '')
    .trim();
}

/**
 * Which game mode a world is, or null for the main game.
 *
 * A main-game world whose activity merely MENTIONS a mode is still the main game: only flags can
 * make a world a separate save, and the activity only says which one. No flags at all (an older
 * plugin) is the main game too — nothing is assumed.
 */
export function resolveWorldMode(typesRaw: unknown, activityRaw: unknown): WorldMode | null {
  const types = parseWorldTypes(typesRaw);
  const activity = cleanActivity(activityRaw);
  const unknownFlags = [...types].filter((t) => !MAIN_FLAGS.has(t) && !MODE_FLAGS.has(t));
  const separate = [...types].some((t) => MODE_FLAGS.has(t)) || unknownFlags.length > 0;
  if (!separate) return null;

  // The activity names the mode most precisely (Grid Master may share Leagues' SEASONAL flag).
  if (activity) {
    for (const m of WORLD_MODES) {
      if (m.activity?.test(activity)) {
        // A Deadman world whose flags also say SEASONAL is seasonal Deadman, whatever it's called.
        if (m.key === 'deadman' && types.has('SEASONAL')) return fromDef(BY_KEY.get('seasonal-deadman')!);
        return fromDef(m);
      }
    }
  }
  // A flag we've never seen is a new mode, even when an old flag rides along.
  if (unknownFlags.length > 0) return named(activity, unknownFlags[0]);
  for (const m of WORLD_MODES) {
    if (m.flags?.(types)) {
      // A brand-new mode Jagex runs on SEASONAL worlds (as Grid Master did) arrives here with an
      // activity line nothing above recognised. Name it from that line rather than call it Leagues.
      if (m.key === 'leagues' && activity && !m.activity!.test(activity)) return named(activity, 'SEASONAL');
      return fromDef(m);
    }
  }
  return named(activity, unknownFlags[0] ?? 'UNKNOWN');
}

function fromDef(m: WorldModeDef): WorldMode {
  return { key: m.key, label: m.label, icon: m.icon, known: true };
}

function named(activity: string | null, flag: string): WorldMode {
  const base = activity ? seasonless(activity) || activity : flag.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const key = modeSlug(base) || 'other';
  // A name that collides with a catalogued key is that mode.
  const def = BY_KEY.get(key);
  if (def) return fromDef(def);
  return { key, label: base, icon: null, known: false };
}

// ── Per-clan routing ──────────────────────────────────────────────────────────────────────────

/** Leagues predates this file and keeps its settings; every other mode gets keys from its own key. */
export function modeWebhookKey(key: string): string {
  return key === 'leagues' ? 'webhook_leagues' : `webhook_mode_${key}`;
}
export function modeIconKey(key: string): string {
  return key === 'leagues' ? 'leagues_icon_url' : `world_mode_icon_${key}`;
}
/** The Discord page's feed id for a mode (Leagues keeps its old one). */
export function modeFeedId(key: string): string {
  return key === 'leagues' ? 'leagues' : `mode:${key}`;
}
export function modeKeyFromFeedId(id: string): string | null {
  if (id === 'leagues') return 'leagues';
  if (!id.startsWith('mode:')) return null;
  const key = id.slice(5);
  return MODE_KEY.test(key) ? key : null;
}
export function modeKeyFromWebhookKey(settingKey: string): string | null {
  if (settingKey === 'webhook_leagues') return 'leagues';
  if (!settingKey.startsWith('webhook_mode_')) return null;
  const key = settingKey.slice('webhook_mode_'.length);
  return MODE_KEY.test(key) ? key : null;
}
const MODE_KEY = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export function isModeKey(key: unknown): key is string {
  return typeof key === 'string' && MODE_KEY.test(key);
}

/** Master switch: off keeps every mode's posts in the normal channels (still labelled). */
export const WORLD_MODES_SPLIT_KEY = 'world_modes_split';
/** Modes whose posts go nowhere at all: JSON list of mode keys. */
export const WORLD_MODES_OFF_KEY = 'world_modes_off';
/** Per mode, the kinds of post it drops: JSON list of notify channels. Absent = all kinds post. */
export function modeKindsOffKey(key: string): string {
  return `world_mode_kinds_off_${key}`;
}
/** Per mode, its own drop floor (1-in-N, lib/modeFilters). Absent = the main-game floor. */
export function modeDropFloorKey(key: string): string {
  return `world_mode_drop_floor_${key}`;
}
/** Per mode, its own drop minimum value in gp (lib/modeFilters). Absent = the main-game value gate. */
export function modeDropValueKey(key: string): string {
  return `world_mode_drop_value_${key}`;
}
/** Per mode, its own level rules (JSON, lib/modeFilters). Absent = the mode posts no level-ups. */
export function modeLevelsKey(key: string): string {
  return `world_mode_levels_${key}`;
}
/** Modes this clan's members have been seen on that the catalogue doesn't know: JSON [{key,label}]. */
export const WORLD_MODES_SEEN_KEY = 'world_modes_seen';
export const MAX_SEEN_MODES = 20;

export interface ModeRouting {
  /** The master switch. */
  split: boolean;
  /** This mode is switched off entirely. */
  modeOff: boolean;
  /** Notify channels this mode doesn't post. */
  kindsOff: ReadonlySet<string>;
  /** The mode's own channel, if set. */
  modeHook: string | null;
  /** Where the post would go on the main game. */
  normalHook: string | null;
}

/**
 * Where one post from a game mode goes in one clan.
 *
 * Off (the mode, or this kind of post for it) means nowhere. With the master switch on, the mode's
 * own channel wins; without one — or with the switch off — it lands where the same post from the
 * main game would, so routing is an improvement and never the reason a post is lost.
 */
export function routeModePost(channel: string, r: ModeRouting): string | null {
  if (r.modeOff || r.kindsOff.has(channel)) return null;
  if (r.split && r.modeHook) return r.modeHook;
  return r.normalHook;
}

export function parseStringList(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 64) : [];
  } catch {
    return [];
  }
}

export interface SeenMode {
  key: string;
  label: string;
}

export function parseSeenModes(raw: string | null | undefined): SeenMode[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is SeenMode => !!x && isModeKey(x.key) && typeof x.label === 'string')
      .map((x) => ({ key: x.key, label: x.label.slice(0, 64) }))
      .slice(0, MAX_SEEN_MODES);
  } catch {
    return [];
  }
}

/** Add a newly seen mode; null when nothing changes (known, already listed, or the list is full). */
export function withSeenMode(seen: SeenMode[], mode: WorldMode): SeenMode[] | null {
  if (mode.known || seen.some((s) => s.key === mode.key) || seen.length >= MAX_SEEN_MODES) return null;
  return [...seen, { key: mode.key, label: mode.label }];
}

/** Embed marker: "[Deadman] …" on the title, the mode's art as the thumbnail when there's none. */
export function markMode(
  embed: Record<string, unknown> | null,
  label: string,
  iconUrl: string | null,
): Record<string, unknown> | null {
  if (!embed) return embed;
  const tag = `[${label}]`;
  const raw = typeof embed.title === 'string' ? embed.title : '';
  // Older plugins' seasonal posts were already stamped by a previous pass; never stamp twice.
  const title = raw.startsWith(tag) ? raw : `${tag} ${raw.replace(/^\[Seasonal\]\s*/, '')}`.trim();
  return { ...embed, title, ...(embed.thumbnail || !iconUrl ? {} : { thumbnail: { url: iconUrl } }) };
}
