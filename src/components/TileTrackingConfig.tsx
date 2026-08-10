"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SKILLS, SKILL_LABELS, SKILL_ALIASES, BOSSES, DIARY_AREAS, DIARY_TIERS, CA_TIERS, RAID_MODE_VARIANTS } from "@/lib/constants";
import Select from '@/components/Select';
import Input from '@/components/Input';
import Combobox from '@/components/Combobox';
import ChipsInput from '@/components/ChipsInput';
import Textarea from '@/components/Textarea';
import { splitCategories, tileTierKey, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { statKeys } from '@/lib/tileKinds';
import { TRIAL_RANK_ACTIVITIES } from '@/lib/barracudaTrials';
import type { TileConfig, TileMissionRules } from '@/lib/types';
import { parseTileMissionRules } from '@/lib/eventRules';
import NumberInput from '@/components/NumberInput';

interface Props {
  /** Board editing: the tile row being edited. Omit when `onSave` takes over the write. */
  tileId?: number;
  /** Board editing: the event that owns the tile. Omit when `onSave` takes over the write. */
  eventId?: number;
  /**
   * Detached editing (the task library): handle the write yourself instead of PUTting to the
   * board's tiles endpoint. Receives the same payload the board API would get and returns the
   * saved TileConfig, or null if the save failed (the component then shows its error state).
   */
  onSave?: (payload: Record<string, unknown>) => Promise<TileConfig | null>;
  initial: TileConfig;
  onSaved: (updated: TileConfig) => void;
  eventStarted?: boolean;
  /** Current user is an admin — gates the live-event override that unlocks frozen fields. */
  isAdmin?: boolean;
  pointsMode?: boolean;
  /** Admin-configured difficulty bands — drives the tier picker on the points field. */
  tierBands?: TierBand[];
  /** Categories already used elsewhere on this board, offered as typeahead in the tag input. */
  categorySuggestions?: string[];
}

// A tile is exactly ONE kind. The kind decides which fields are meaningful — the form
// shows only those, and switching kind clears the others so the data model can never
// hold a nonsensical combo (e.g. a 10M-XP goal on a drop tile).
type TileKind = 'standard' | 'skill' | 'boss' | 'drop' | 'collection' | 'kill' | 'pvp' | 'timed' | 'lms' | 'value' | 'diary' | 'ca' | 'gain' | 'deathless';

const KINDS: { key: TileKind; label: string; blurb: string }[] = [
  { key: 'standard', label: 'Standard', blurb: 'Manual tile — a captain marks it done. No auto-tracking.' },
  { key: 'skill', label: 'Skill XP', blurb: 'Auto-completes when a skill reaches an XP goal (hiscores-polled).' },
  { key: 'boss', label: 'Boss KC', blurb: 'Auto-completes when a boss reaches a kill-count goal (hiscores-polled).' },
  { key: 'drop', label: 'Item drop', blurb: 'N drops of an item (or any of a pool) — players submit evidence.' },
  { key: 'collection', label: 'Item set (X each)', blurb: 'Multiple items, each with its OWN required count — 1× each for a full Moons set. Name sets on the items for "any one full set" (Barrows).' },
  { key: 'kill', label: 'Kill count', blurb: 'N kills of an NPC — even ones not on the hiscores (chickens, cows). Plugin-detected, baked screenshot.' },
  { key: 'pvp', label: 'PvP kill', blurb: 'Kill rival team members — or a named bounty — in the Wilderness or on PvP worlds. Plugin credits your kill and bakes a death screenshot. Safe minigames (LMS, Soul Wars, PvP Arena) never count.' },
  { key: 'gain', label: 'Item gain', blurb: 'Catch/cook/gather N of an item — counted from inventory gains (karambwans fished, implings jarred, food cooked). Plugin-detected, baked screenshot.' },
  { key: 'timed', label: 'Timed clear', blurb: 'Clear an activity under a time cap (Inferno, raids, Colosseum). Plugin times it and bakes the result.' },
  { key: 'deathless', label: 'Deathless raid', blurb: 'Complete a raid with ZERO party deaths, N times. Plugin counts deaths in the instance and credits off the completion message.' },
  { key: 'lms', label: 'LMS placement', blurb: 'Place top-N in Last Man Standing (1 = win), M times. Plugin-detected at game end, baked screenshot.' },
  { key: 'value', label: 'Loot value', blurb: 'Loot worth X gp — one big haul, or hauls summing to a target. Loot keys, PvP kills, any drop. Plugin prices the haul and bakes proof.' },
  { key: 'diary', label: 'Diary', blurb: 'Complete achievement-diary tiers during the event — a specific diary or any diary of a tier. Plugin-detected off the completion message.' },
  { key: 'ca', label: 'Combat task', blurb: 'Complete Combat Achievement tasks during the event — specific tasks or any task of a tier. Players who already own a task can re-trigger it via the in-game "Repeat completion" setting. Plugin-detected off the completion message.' },
];

// Accepts "5m", "500k", "2.5m" or plain gp figures (commas ok) for the loot-value threshold.
function parseGp(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(/,/g, '');
  const m = v.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/);
  if (!m) return null;
  const mult = m[2] === 'b' ? 1_000_000_000 : m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1;
  const n = Math.round(parseFloat(m[1]) * mult);
  return Number.isFinite(n) && n >= 1 && n <= 2_147_483_647 ? n : null;
}

// Diary selectors are "<Area> <Tier>" strings with "Any" as a wildcard on either side.
const DIARY_ANY = 'Any';

// Activity hints for timed tiles. The free-text field accepts any name the plugin can time —
// anything that prints a "duration:" / "completion time:" / "Time:" / "Subdued in" chat line
// works when the tile's activity text appears in the adjacent kill/completion-count message
// (or the plugin's alias table covers it). Nearly every boss has an in-game kill timer these
// days, so derive the list from the boss-KC picker's BOSSES constant instead of hand-curating.
// A few labels need fixing up first: display shorthands ("Thermy") don't appear in the game's
// count line, "The …" names drop the article there, boss-name duplicates of a named activity
// (TzKal-Zuk vs Inferno) would just be noise, and a couple of activities end without any
// duration line the plugin can parse.
const TIMED_LABEL_FIXES: Record<string, string | null> = {
  'TzKal-Zuk': null,       // covered by 'Inferno'
  'TzTok-Jad': null,       // covered by 'Fight Caves'
  'Sol Heredit': null,     // covered by 'Fortis Colosseum'
  'Thermy': 'Thermonuclear Smoke Devil',
  // Raids (base + every mode) are appended from RAID_MODE_VARIANTS below — the single source of truth
  // for the exact game strings (CoX CM has NO colon; ToB/ToA modes DO). Drop them here so they aren't
  // listed twice, once here and once from that constant.
  'Chambers of Xeric': null,
  'CoX: CM': null,
  'Theatre of Blood': null,
  'ToB: HM': null,
  'Tombs of Amascut': null,
  'ToA: Expert': null,
  'The Leviathan': 'Leviathan',       // "Your Leviathan kill count is: N" — no article
  'The Whisperer': 'Whisperer',
  'The Hueycoatl': 'Hueycoatl',
  'The Royal Titans': 'Royal Titans',
  'Lunar Chests': null,    // Moons of Peril has no timer — a chest count line, no duration to pair
  'Wintertodt': null,      // no duration line
  'Zalcano': null,         // no in-game kill timer
};
const TIMED_ACTIVITY_SUGGESTIONS = [
  ...new Set([
    // Named activities first — the usual phrasing on timed tiles.
    'Inferno',
    'Fight Caves',
    'Fortis Colosseum',
    'TzHaar-Ket-Rak',
    // Sailing's Barracuda Trials: each course awards one of three ranks by time, and the ranks are
    // SEPARATE challenges — so tiles target an exact course + rank ("Gwenith Glide — Marlin"), gated
    // on the rank the game reports (not a time cap). The nine combos come from lib/barracudaTrials.
    ...TRIAL_RANK_ACTIVITIES,
    // Hallowed Sepulchre ("Overall time:" on the exit).
    'Hallowed Sepulchre',
    // Raids — base + every mode, from RAID_MODE_VARIANTS (the same strings the deathless/kill pickers
    // use), so the exact game spelling for each raid mode lives in exactly one place.
    ...RAID_MODE_VARIANTS.flatMap((r) => [r.base, ...r.modes]),
    ...BOSSES
      .map((b) => (b.label in TIMED_LABEL_FIXES ? TIMED_LABEL_FIXES[b.label] : b.label))
      .filter((s): s is string => !!s),
  ]),
];

// Autocomplete hints for the source filter. The plugin matches entries EXACTLY
// (case-insensitive) against the name RuneLite reports — a misspelled source silently never
// matches. Raid/chest loot uses the chest's event name (not the room boss), direct kills the
// NPC name, clue caskets "Clue Scroll (Tier)". The field still accepts any free-text name.
//
// Boss names come from the boss-KC picker's BOSSES constant (like the timed list), fixed up
// where the hiscores label differs from the name loot is actually reported under.
const SOURCE_LABEL_FIXES: Record<string, string | null> = {
  'CoX: CM': null,          // the chest reports the plain raid name regardless of mode
  'ToB: HM': null,
  'ToA: Expert': null,
  'Sol Heredit': null,      // colosseum loot is the chest → "Fortis Colosseum"
  'Lunar Chests': 'Lunar Chest',          // RuneLite's event name is singular
  'Nightmare': 'The Nightmare',           // NPC name carries the article
  'Mimic': 'The Mimic',
  'Thermy': 'Thermonuclear Smoke Devil',  // display shorthand
  'The Gauntlet': 'Crystalline Hunllef',  // loot is attributed to the Hunllef, not a chest
  'Corrupted Gauntlet': 'Corrupted Hunllef',
  'Grotesque Guardians': 'Dusk',          // Dusk drops the loot
  'Wintertodt': null,       // covered by the crate/cart event names below
  'Tempoross': null,        // covered by the pool/casket event names below
};
const SOURCE_SUGGESTIONS = [
  ...new Set([
    // Raids & bosses (chest-style event loot)
    'Chambers of Xeric',
    'Theatre of Blood',
    'Tombs of Amascut',
    'Fortis Colosseum',
    'Doom of Mokhaiotl',
    'Lunar Chest',
    'Barrows',
    'Unsired',
    // Clue caskets
    'Clue Scroll (Beginner)',
    'Clue Scroll (Easy)',
    'Clue Scroll (Medium)',
    'Clue Scroll (Hard)',
    'Clue Scroll (Elite)',
    'Clue Scroll (Master)',
    // Wilderness keys & chests
    'Loot Chest',
    "Larran's big chest",
    "Larran's small chest",
    "Rogues' Chest",
    // Skilling rewards
    'Reward pool (Tempoross)',
    'Casket (Tempoross)',
    'Supply crate (Wintertodt)',
    'Reward cart (Wintertodt)',
    'Guardians of the Rift',
    'Hallowed Sack',
    'Fishing Trawler',
    'Herbiboar',
    'Drift Net',
    'Seed pack',
    'Bird nest',
    // Other chests
    'Brimstone Chest',
    'Grubby Chest',
    'Crystal Chest',
    'Elven Crystal Chest',
    // Impling jars (opened)
    'Dragon impling jar',
    'Lucky impling jar',
    // Direct kills — every boss, by the name its loot is reported under.
    ...BOSSES
      .map((b) => (b.label in SOURCE_LABEL_FIXES ? SOURCE_LABEL_FIXES[b.label] : b.label))
      .filter((s): s is string => !!s),
  ]),
];

// Source hints for loot-value tiles — "PvP" (player-kill loot) first; "Loot Chest" (opened
// loot keys) is already in the shared list.
const VALUE_SOURCE_SUGGESTIONS = ['PvP', ...SOURCE_SUGGESTIONS];

// Party size is only knowable inside raid instances, so the drop-tile party gate only
// shows once the source restriction names a raid.
const RAID_SOURCES = ['chambers of xeric', 'theatre of blood', 'tombs of amascut'];
function sourcesIncludeRaid(sourceText: string): boolean {
  return sourceText
    .toLowerCase()
    .split(',')
    .some((s) => RAID_SOURCES.some((raid) => s.trim().includes(raid)));
}
// Same gate for the timed kind: the party-size field only shows when the activity is a raid.
function activityIsRaid(activity: string): boolean {
  const a = activity.toLowerCase();
  return RAID_SOURCES.some((raid) => a.includes(raid));
}

// Deathless tiles only make sense for group PvM with a completion message the plugin can
// correlate — the raids. Free text still accepted for future content. Base and per-mode
// entries come from RAID_MODE_VARIANTS so the exact game strings live in one place
// (the old hand-written list carried "Chambers of Xeric: Challenge Mode" — the game string
// has no colon, so CM tiles authored from it never credited).
const DEATHLESS_ACTIVITY_SUGGESTIONS = RAID_MODE_VARIANTS.flatMap((r) => [r.base, ...r.modes]);

// The same base + per-mode strings, offered as one-click adds on kill tiles (the KC chat
// line is matched exactly there, so "both normal and CM" means adding both strings).
const RAID_KC_NAMES = DEATHLESS_ACTIVITY_SUGGESTIONS;

function deriveKind(initial: TileConfig): TileKind {
  if (initial.tileType === 'drop') {
    return initial.itemRequirements && initial.itemRequirements.length > 0 ? 'collection' : 'drop';
  }
  if (initial.tileType === 'kill') return 'kill';
  if (initial.tileType === 'pvp') return 'pvp';
  if (initial.tileType === 'gain') return 'gain';
  if (initial.tileType === 'timed') return 'timed';
  if (initial.tileType === 'deathless') return 'deathless';
  if (initial.tileType === 'lms') return 'lms';
  if (initial.tileType === 'value' || initial.tileType === 'valuetotal') return 'value';
  if (initial.tileType === 'diary') return 'diary';
  if (initial.tileType === 'ca') return 'ca';
  if (initial.statType === 'skill') return 'skill';
  if (initial.statType === 'boss') return 'boss';
  return 'standard';
}

// mm:ss <-> seconds helpers for the timed-tile threshold input.
function secondsToClock(total: number | null | undefined): string {
  if (total == null || total < 0) return '';
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function clockToSeconds(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  // Accept "mm:ss", "h:mm:ss", or a bare seconds count.
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  const parts = v.split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (parts.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

// Parse a number token like "35", "1,000", "500k", "1.5m" into an integer (null if not a number).
function parseAmountToken(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/^([\d,]*\.?\d+)\s*([kmb])?$/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (!isFinite(n)) return null;
  const suf = m[2]?.toLowerCase();
  if (suf === 'k') n *= 1e3;
  else if (suf === 'm') n *= 1e6;
  else if (suf === 'b') n *= 1e9;
  return Math.round(n);
}

// Count-like numbers in a title/description — skips obvious non-counts (times, part numbers, levels)
// so the "amount doesn't match" hint doesn't fire on "part: 2" or "clear below 25 minutes".
function extractCountLikeNumbers(text: string): number[] {
  if (!text) return [];
  const out: number[] = [];
  const re = /([\d,]*\.?\d+)\s*([kmb])?\b\s*([a-z]+)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const val = parseAmountToken(m[1] + (m[2] ?? ''));
    if (val == null) continue;
    const before = text.slice(Math.max(0, m.index - 8), m.index).toLowerCase();
    const after = (m[3] ?? '').toLowerCase();
    if (/part|lvl|level/.test(before)) continue;
    if (
      /^(min|mins|minute|minutes|hour|hours|hr|hrs|sec|secs|second|seconds|part|parts|tier|lvl|level|day|days|week|weeks|am|pm|st|nd|rd|th)$/.test(after)
    ) {
      continue;
    }
    out.push(val);
  }
  return out;
}

export default function TileTrackingConfig({
  tileId,
  eventId,
  onSave,
  initial,
  onSaved,
  eventStarted,
  isAdmin,
  pointsMode,
  tierBands,
  categorySuggestions,
}: Props) {
  // Difficulty bands, ascending — the tier picker sets points to a band's floor, and the
  // current points value maps back to whichever band it falls in.
  const bands = (tierBands && tierBands.length > 0 ? [...tierBands] : [...DEFAULT_TIER_BANDS])
    .sort((a, b) => a.min - b.min);
  // Admin live-event override: after start, label/kind/required-amount are frozen. An admin can opt
  // into unlocking them to fix a misconfigured tile mid-event; the save is flagged as an override in
  // the tile history. `locked` is the effective "is this field frozen right now" flag the inputs use.
  const canOverride = !!eventStarted && !!isAdmin;
  const [liveOverride, setLiveOverride] = useState(false);
  const locked = !!eventStarted && !(canOverride && liveOverride);
  const [kind, setKind] = useState<TileKind>(() => deriveKind(initial));
  const [label, setLabel] = useState<string>(initial.label);
  const [description, setDescription] = useState<string>(initial.description || "");
  const [requiredAmount, setRequiredAmount] = useState<string>(initial.requiredAmount?.toString() || "");
  const [trackedStat, setTrackedStat] = useState<string>(initial.trackedStat || "");
  const [statGoal, setStatGoal] = useState<string>(initial.statGoal?.toString() || "");
  // "solo" was the old wire value for the "Solo (Any Member)" mode; the backend only ever honoured
  // "individual", so normalize on load (the 0027 data migration flips stored rows too).
  const [trackingMode, setTrackingMode] = useState<string>(
    initial.trackingMode === "solo" ? "individual" : initial.trackingMode || "team",
  );
  const [optional, setOptional] = useState<boolean>(initial.optional || false);
  // Admin kill-switch: when on, the site won't auto-credit this tile — it's completed manually.
  const [autoTrackDisabled, setAutoTrackDisabled] = useState<boolean>(initial.autoTrackDisabled || false);
  const [points, setPoints] = useState<string>(initial.points != null ? initial.points.toString() : "1");
  const [category, setCategory] = useState<string>(initial.category || "");
  // Mission config — a mission is hidden until announced mid-event and carries its own scoring.
  const initMissionDecay = initial.missionRules?.decay ?? null;
  const [mission, setMission] = useState<boolean>(!!initial.mission);
  const [missionLockout, setMissionLockout] = useState<boolean>(!!initial.missionRules?.lockout);
  const [missionFirstBonus, setMissionFirstBonus] = useState<string>(
    initial.missionRules?.firstBonus ? String(initial.missionRules.firstBonus) : "",
  );
  const [missionDecayMode, setMissionDecayMode] = useState<'off' | 'decay' | 'grow'>(
    initMissionDecay ? (initMissionDecay.targetPct > 100 ? 'grow' : 'decay') : 'off',
  );
  const [missionDecayTargetPct, setMissionDecayTargetPct] = useState<string>(
    initMissionDecay ? String(initMissionDecay.targetPct) : "",
  );
  const [missionDecayHours, setMissionDecayHours] = useState<string>(
    initMissionDecay ? String(initMissionDecay.hours) : "6",
  );
  const [missionExpiryHours, setMissionExpiryHours] = useState<string>(
    initial.missionRules?.expiryHours != null ? String(initial.missionRules.expiryHours) : "",
  );
  // Assemble the per-mission scoring the save sends (null when this tile isn't a mission).
  const buildMissionRules = (): TileMissionRules | null => {
    if (!mission) return null;
    let decay: TileMissionRules['decay'] = null;
    if (missionDecayMode !== 'off') {
      const fallback = missionDecayMode === 'grow' ? 200 : 50;
      const targetPct = missionDecayTargetPct ? Math.max(0, parseInt(missionDecayTargetPct, 10) || fallback) : fallback;
      decay = { targetPct, hours: Math.max(1, parseInt(missionDecayHours, 10) || 6) };
    }
    return {
      lockout: missionLockout,
      firstBonus: missionFirstBonus ? Math.max(0, parseInt(missionFirstBonus, 10) || 0) : 0,
      decay,
      expiryHours: missionExpiryHours ? Math.max(1, parseInt(missionExpiryHours, 10) || 6) : null,
    };
  };
  // Comma-separated source NPC names (drop kinds only) — e.g. "Tekton". Empty = any source.
  const [sourceNpcsText, setSourceNpcsText] = useState<string>((initial.sourceNpcs || []).join(", "));
  // Kill-tile target NPC names — a multi-pick set (any listed name counts). Variants like
  // "The Nightmare" + "Phosani's Nightmare" can all be added so any of them count. The same
  // column carries diary and CA selectors when the tile is one of those kinds, so scope each
  // state to its own kind here.
  const [targetNpcNames, setTargetNpcNames] = useState<string[]>(
    initial.tileType === 'diary' || initial.tileType === 'ca' || initial.tileType === 'pvp' ? [] : initial.targetNpcs || [],
  );
  // Diary selectors — "<Area> <Tier>" strings, "Any" wildcard on either side.
  const [diarySelectors, setDiarySelectors] = useState<string[]>(
    initial.tileType === 'diary' ? initial.targetNpcs || [] : [],
  );
  // PvP-kill selectors ride the targetNpcs column too — 'any' (any player at all), 'team:other'
  // (any rival team member), or 'rsn:<name>' bounty entries. Split back into mode + RSN text.
  const [pvpTargetMode, setPvpTargetMode] = useState<'anyone' | 'other-team' | 'rsn'>(() => {
    if (initial.tileType !== 'pvp') return 'other-team';
    const t = initial.targetNpcs || [];
    if (t.includes('any')) return 'anyone';
    if (t.some((s) => s.startsWith('rsn:'))) return 'rsn';
    return 'other-team';
  });
  const [pvpRsnsText, setPvpRsnsText] = useState<string>(
    initial.tileType === 'pvp'
      ? (initial.targetNpcs || []).filter((s) => s.startsWith('rsn:')).map((s) => s.slice(4)).join(', ')
      : '',
  );
  const [diaryArea, setDiaryArea] = useState<string>(DIARY_ANY);
  const [diaryTier, setDiaryTier] = useState<string>('Elite');
  // CA selectors — exact task names ("Whack-a-Mole") or "Any <Tier>" wildcards.
  const [caSelectors, setCaSelectors] = useState<string[]>(
    initial.tileType === 'ca' ? initial.targetNpcs || [] : [],
  );
  const [caTier, setCaTier] = useState<string>('Master');
  const [caSearch, setCaSearch] = useState('');
  // The full task list, fetched once the CA kind is first shown (small: ~640 rows).
  const [caTasks, setCaTasks] = useState<{ name: string; monster: string | null; tier: string; type: string | null }[] | null>(null);
  const [showCaDropdown, setShowCaDropdown] = useState(false);
  const caSearchRef = useRef<HTMLDivElement>(null);
  const [npcSearch, setNpcSearch] = useState("");
  const [npcResults, setNpcResults] = useState<string[]>([]);
  const [npcSearching, setNpcSearching] = useState(false);
  const [showNpcDropdown, setShowNpcDropdown] = useState(false);
  const npcSearchRef = useRef<HTMLDivElement>(null);
  const npcSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timed-tile activity + threshold. (timeThresholdSeconds doubles as the LMS placement cap,
  // so only seed the clock field when this tile really is the timed kind.)
  const [timedActivity, setTimedActivity] = useState<string>(initial.timedActivity || "");
  const [timeThresholdClock, setTimeThresholdClock] = useState<string>(
    secondsToClock(initial.tileType === 'timed' ? initial.timeThresholdSeconds : null),
  );
  // LMS placement cap (1 = must win; 3 = top-3). Rides the timeThresholdSeconds column.
  const [lmsPlacementCap, setLmsPlacementCap] = useState<string>(
    initial.tileType === 'lms' && initial.timeThresholdSeconds ? String(initial.timeThresholdSeconds) : '1',
  );
  // Deathless party size (blank = any size). Also rides the timeThresholdSeconds column.
  const [deathlessPartySize, setDeathlessPartySize] = useState<string>(
    initial.tileType === 'deathless' && initial.timeThresholdSeconds ? String(initial.timeThresholdSeconds) : '',
  );
  // Drop-tile raid party size (blank = any) — "solo Cursed phalanx". Rides timeThresholdSeconds.
  const [dropPartySize, setDropPartySize] = useState<string>(
    initial.tileType === 'drop' && initial.timeThresholdSeconds ? String(initial.timeThresholdSeconds) : '',
  );
  // Timed raid party size (blank = any). Has its own column — timeThresholdSeconds already
  // holds the time cap on timed tiles, so there's nothing left to overload.
  const [timedPartySize, setTimedPartySize] = useState<string>(
    initial.tileType === 'timed' && initial.partySize ? String(initial.partySize) : '',
  );
  // Loot-value threshold in gp (rides the requiredAmount column for the value kind).
  const [valueGpText, setValueGpText] = useState<string>(
    (initial.tileType === 'value' || initial.tileType === 'valuetotal') && initial.requiredAmount
      ? String(initial.requiredAmount)
      : '',
  );
  // PvP min-loot floor in gp — a kill only counts if its loot is worth at least this. Empty = 0
  // (no minimum, every kill counts). Accepts 5m / 500k shorthand via parseGp, like the value field.
  const [pvpMinLootText, setPvpMinLootText] = useState<string>(
    initial.tileType === 'pvp' && initial.pvpMinLootValue ? String(initial.pvpMinLootValue) : '',
  );
  // 'single' = one haul must meet the threshold; 'total' = hauls sum toward it.
  const [valueMode, setValueMode] = useState<'single' | 'total'>(
    initial.tileType === 'valuetotal' ? 'total' : 'single',
  );
  const [trackedItems, setTrackedItems] = useState<{ id: number; name: string; perItemAmount: number; group?: string }[]>(
    initial.itemRequirements?.length
      ? initial.itemRequirements.map((r) => ({ id: r.itemId, name: r.name, perItemAmount: r.requiredAmount, group: r.group ?? undefined }))
      : (initial.trackedItemIds || []).map((id) => ({ id, name: `Item #${id}`, perItemAmount: 1 })),
  );
  const [itemSearch, setItemSearch] = useState("");
  const [itemResults, setItemResults] = useState<{ id: number; name: string }[]>([]);
  const [itemSearching, setItemSearching] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live NPC hits for the source fields — the curated SOURCE_SUGGESTIONS only cover event/chest
  // loot; direct-kill sources are any NPC, so search the wiki monster list as the admin types
  // (same dataset as the kill-tile picker) and merge the hits into the suggestions.
  const [sourceNpcHits, setSourceNpcHits] = useState<string[]>([]);
  const sourceNpcTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const segment = (sourceNpcsText.split(',').pop() ?? '').trim();
    if (segment.length < 2) {
      setSourceNpcHits([]);
      return;
    }
    if (sourceNpcTimeout.current) clearTimeout(sourceNpcTimeout.current);
    sourceNpcTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/npc-search?q=${encodeURIComponent(segment)}`);
        if (res.ok) {
          const results = (await res.json()) as { name: string }[];
          setSourceNpcHits(results.map((r) => r.name).slice(0, 10));
        }
      } catch { /* ignore */ }
    }, 300);
    return () => {
      if (sourceNpcTimeout.current) clearTimeout(sourceNpcTimeout.current);
    };
  }, [sourceNpcsText]);
  const sourceSuggestions = useMemo(
    () => [...new Set([...SOURCE_SUGGESTIONS, ...sourceNpcHits])],
    [sourceNpcHits],
  );
  const valueSourceSuggestions = useMemo(
    () => [...new Set([...VALUE_SOURCE_SUGGESTIONS, ...sourceNpcHits])],
    [sourceNpcHits],
  );
  // Concurrency stamp from the freshly-fetched tile; refreshed after each save so
  // consecutive saves in one sitting keep passing the PUT's baseUpdatedAt check.
  const [baseStamp, setBaseStamp] = useState<string | null>(initial.updatedAt ?? null);

  const isStat = kind === 'skill' || kind === 'boss';
  const isDrop = kind === 'drop' || kind === 'collection';
  const isCollection = kind === 'collection';
  const isKill = kind === 'kill';
  const isPvp = kind === 'pvp';
  const isGain = kind === 'gain';
  const isTimed = kind === 'timed';
  const isDeathless = kind === 'deathless';
  const isLms = kind === 'lms';
  const isValue = kind === 'value';
  const isDiary = kind === 'diary';
  const isCa = kind === 'ca';

  // Load the CA task list the first time the CA kind is shown; filter locally as the admin types.
  useEffect(() => {
    if (!isCa || caTasks !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/ca-tasks');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCaTasks(data.tasks ?? []);
        }
      } catch { /* ignore — the wildcard picker still works without the list */ }
    })();
    return () => { cancelled = true; };
  }, [isCa, caTasks]);

  const caResults = useMemo(() => {
    const q = caSearch.trim().toLowerCase();
    if (!caTasks || q.length < 2) return [];
    const chosen = new Set(caSelectors.map((s) => s.toLowerCase()));
    return caTasks
      .filter((t) => !chosen.has(t.name.toLowerCase()) &&
        (t.name.toLowerCase().includes(q) || (t.monster ?? '').toLowerCase().includes(q)))
      .slice(0, 12);
  }, [caTasks, caSearch, caSelectors]);

  // Resolve names for pre-existing tracked item IDs (simple-mode tiles store only IDs).
  useEffect(() => {
    if (initial.itemRequirements?.length) return;
    if (!initial.trackedItemIds?.length) return;
    Promise.all(
      initial.trackedItemIds.map(async (id) => {
        try {
          const res = await fetch(`/api/admin/items-search?q=${id}`);
          if (res.ok) {
            const results = await res.json();
            const match = results.find((r: { id: number }) => r.id === id);
            if (match) return { ...match, perItemAmount: 1 };
          }
        } catch { /* ignore */ }
        return { id, name: `Item #${id}`, perItemAmount: 1 };
      }),
    ).then(setTrackedItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchItems = useCallback(async (query: string) => {
    if (query.length < 2) {
      setItemResults([]);
      return;
    }
    setItemSearching(true);
    try {
      const res = await fetch(`/api/admin/items-search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const results = await res.json();
        const existingIds = new Set(trackedItems.map((i) => i.id));
        setItemResults(results.filter((r: { id: number }) => !existingIds.has(r.id)));
      }
    } catch { /* ignore */ }
    setItemSearching(false);
  }, [trackedItems]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
      if (npcSearchRef.current && !npcSearchRef.current.contains(e.target as Node)) {
        setShowNpcDropdown(false);
      }
      if (caSearchRef.current && !caSearchRef.current.contains(e.target as Node)) {
        setShowCaDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // NPC name search (kill tiles) — backed by the OSRS Wiki monster list. Excludes names
  // already added so the dropdown only offers new ones.
  const searchNpcs = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setNpcResults([]);
      return;
    }
    setNpcSearching(true);
    try {
      const res = await fetch(`/api/admin/npc-search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const results = (await res.json()) as { name: string }[];
        const existing = new Set(targetNpcNames.map((n) => n.toLowerCase()));
        setNpcResults(results.map((r) => r.name).filter((n) => !existing.has(n.toLowerCase())));
      }
    } catch { /* ignore */ }
    setNpcSearching(false);
  }, [targetNpcNames]);

  function addNpc(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setTargetNpcNames((prev) =>
      prev.some((n) => n.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed],
    );
  }
  function addAllNpcResults() {
    if (npcResults.length === 0) return;
    setTargetNpcNames((prev) => {
      const seen = new Set(prev.map((n) => n.toLowerCase()));
      const merged = [...prev];
      for (const n of npcResults) {
        if (!seen.has(n.toLowerCase())) {
          merged.push(n);
          seen.add(n.toLowerCase());
        }
      }
      return merged;
    });
    setNpcResults([]);
    setNpcSearch("");
    setShowNpcDropdown(false);
  }
  function removeNpc(name: string) {
    setTargetNpcNames((prev) => prev.filter((n) => n !== name));
  }

  // Switching kind wipes the other kinds' fields so a save can't smuggle stale data.
  function changeKind(next: TileKind) {
    setKind(next);
    setError(null);
    // Fields not relevant to the destination kind are always cleared; each branch then
    // keeps only what it needs.
    if (next === 'skill' || next === 'boss') {
      setTrackedStat("");
      setStatGoal("");
      setTrackingMode("team");
      setRequiredAmount("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'drop' || next === 'collection') {
      setTrackedStat("");
      setStatGoal("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'kill') {
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'pvp') {
      // Keeps pvpTargetMode/pvpRsnsText + requiredAmount — the pvp kind's whole config.
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'gain') {
      // Keeps trackedItems + requiredAmount — the gain kind's whole config.
      setTrackedStat("");
      setStatGoal("");
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'deathless') {
      // Keeps timedActivity (the raid), requiredAmount (runs) + party size.
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimeThresholdClock("");
      setLmsPlacementCap('1');
    } else if (next === 'diary') {
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'ca') {
      // Keeps caSelectors + requiredAmount — the CA kind's whole config.
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'timed') {
      setTrackedStat("");
      setStatGoal("");
      setRequiredAmount("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setLmsPlacementCap('1');
    } else if (next === 'lms') {
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
      setValueGpText("");
    } else if (next === 'value') {
      setTrackedStat("");
      setStatGoal("");
      setRequiredAmount("");
      setTrackedItems([]);
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
      setLmsPlacementCap('1');
    } else {
      // standard
      setTrackedStat("");
      setStatGoal("");
      setRequiredAmount("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setCaSelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    }
  }

  function validate(): string | null {
    if (kind === 'skill' || kind === 'boss') {
      if (!trackedStat) return `Pick a ${kind === 'skill' ? 'skill' : 'boss'} to track.`;
      const goal = parseInt(statGoal, 10);
      if (!Number.isInteger(goal) || goal < 1) return `Set a ${kind === 'skill' ? 'XP' : 'KC'} goal of at least 1.`;
    }
    if (kind === 'drop') {
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set a required amount of at least 1.';
    }
    if ((kind === 'drop' || kind === 'collection') && sourcesIncludeRaid(sourceNpcsText) && dropPartySize.trim()) {
      const size = parseInt(dropPartySize, 10);
      if (!Number.isInteger(size) || size < 1 || size > 100) return 'Party size must be between 1 and 100 (or blank for any).';
    }
    if (kind === 'collection') {
      if (trackedItems.length === 0) return 'Add at least one item to the collection.';
      if (trackedItems.some((i) => i.perItemAmount < 1)) return 'Each collection item needs a count of at least 1.';
    }
    if (kind === 'kill') {
      if (targetNpcNames.length === 0) return 'Add at least one NPC to count kills for.';
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set a required kill count of at least 1.';
    }
    if (kind === 'pvp') {
      if (pvpTargetMode === 'rsn' && !pvpRsnsText.split(',').some((s) => s.trim())) {
        return 'Name at least one player (RSN) whose death counts, or switch to rival-team kills.';
      }
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set a required kill count of at least 1.';
    }
    if (kind === 'diary') {
      if (diarySelectors.length === 0) return 'Add at least one diary (or "Any") to count completions for.';
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set a required completion count of at least 1.';
    }
    if (kind === 'ca') {
      if (caSelectors.length === 0) return 'Add at least one combat task (or an "Any <tier>" wildcard) to count completions for.';
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set a required completion count of at least 1.';
    }
    if (kind === 'gain') {
      if (trackedItems.length === 0) return 'Add at least one item to count gains for.';
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set how many must be gained (at least 1).';
    }
    if (kind === 'timed') {
      if (!timedActivity.trim()) return 'Name the activity to time (e.g. Inferno).';
      const secs = clockToSeconds(timeThresholdClock);
      if (secs == null || secs < 1) return 'Set a time cap as mm:ss (e.g. 30:00) or seconds.';
      if (secs > 86400) return 'Time cap cannot exceed 24 hours.';
      if (timedPartySize.trim()) {
        const size = parseInt(timedPartySize, 10);
        if (!Number.isInteger(size) || size < 1 || size > 100) return 'Party size must be between 1 and 100 (or blank for any).';
      }
    }
    if (kind === 'deathless') {
      if (!timedActivity.trim()) return 'Pick the raid this tile is for (e.g. Theatre of Blood).';
      const amt = parseInt(requiredAmount || '1', 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set how many deathless runs are needed (at least 1).';
      if (deathlessPartySize.trim()) {
        const size = parseInt(deathlessPartySize, 10);
        if (!Number.isInteger(size) || size < 1 || size > 100) return 'Party size must be between 1 and 100 (or blank for any).';
      }
    }
    if (kind === 'lms') {
      const cap = parseInt(lmsPlacementCap, 10);
      if (!Number.isInteger(cap) || cap < 1 || cap > 24) return 'Set a placement cap between 1 (win) and 24.';
      const amt = parseInt(requiredAmount || '1', 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set how many qualifying games are needed (at least 1).';
    }
    if (kind === 'value') {
      if (parseGp(valueGpText) == null) return 'Set a haul value like 5m, 500k, or 5000000.';
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Build a payload that sets exactly this kind's fields and explicitly NULLs the rest,
      // so the row is always internally consistent.
      const payload: Record<string, unknown> = {
        tileId,
        baseUpdatedAt: baseStamp,
        // Signals the server to unlock label/kind/required-amount on a live board (admin-only,
        // recorded as a live override). Ignored before start and for non-admins.
        liveOverride: canOverride && liveOverride,
        label: label || undefined,
        description: description || null,
        optional,
        autoTrackDisabled,
        points: points ? Math.max(0, parseInt(points, 10) || 0) : 1,
        category: category.trim() || null,
        // Mission flag + per-mission scoring (assembled below; null-rules on a normal tile).
        mission,
        missionRules: buildMissionRules(),
        // defaults — overridden per kind below
        tileType: isDrop ? 'drop' : isKill ? 'kill' : isPvp ? 'pvp' : isGain ? 'gain' : isTimed ? 'timed' : isDeathless ? 'deathless' : isLms ? 'lms' : isValue ? (valueMode === 'total' ? 'valuetotal' : 'value') : isDiary ? 'diary' : isCa ? 'ca' : 'standard',
        trackedStat: null,
        statType: null,
        statGoal: null,
        trackingMode: 'team',
        requiredAmount: null,
        trackedItemIds: null,
        itemRequirements: null,
        sourceNpcs: null,
        targetNpcs: null,
        timedActivity: null,
        timeThresholdSeconds: null,
        partySize: null,
        // Cleared by default so switching away from PvP drops any stale floor; the pvp branch sets it.
        pvpMinLootValue: null,
      };

      if (isStat) {
        payload.statType = kind; // 'skill' | 'boss'
        payload.trackedStat = trackedStat;
        payload.statGoal = parseInt(statGoal, 10);
        payload.trackingMode = trackingMode;
      } else if (kind === 'collection') {
        payload.itemRequirements = trackedItems.map((i) => ({
          itemId: i.id,
          name: i.name,
          requiredAmount: i.perItemAmount,
          group: i.group?.trim() || null,
        }));
      } else if (kind === 'drop') {
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.trackedItemIds = trackedItems.length > 0 ? trackedItems.map((i) => i.id) : null;
      } else if (kind === 'kill') {
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.targetNpcs = targetNpcNames;
        payload.trackingMode = trackingMode;
      } else if (kind === 'pvp') {
        // PvP selectors ride the targetNpcs column — 'any' (any player), 'team:other', or
        // 'rsn:<name>' entries.
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.targetNpcs =
          pvpTargetMode === 'rsn'
            ? pvpRsnsText.split(',').map((s) => s.trim()).filter(Boolean).map((n) => `rsn:${n}`)
            : pvpTargetMode === 'anyone'
              ? ['any']
              : ['team:other'];
        payload.trackingMode = trackingMode;
        // Optional min-loot floor (gp) — parseGp accepts 5m/500k shorthand; blank/invalid = 0 (none).
        payload.pvpMinLootValue = pvpMinLootText.trim() ? parseGp(pvpMinLootText) : null;
      } else if (kind === 'diary') {
        // Diary selectors ride in the targetNpcs column — the diary tileType reinterprets it.
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.targetNpcs = diarySelectors;
        payload.trackingMode = trackingMode;
      } else if (kind === 'ca') {
        // CA selectors (task names / "Any <Tier>") likewise ride in targetNpcs.
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.targetNpcs = caSelectors;
        payload.trackingMode = trackingMode;
      } else if (kind === 'gain') {
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.trackedItemIds = trackedItems.length > 0 ? trackedItems.map((i) => i.id) : null;
        payload.trackingMode = trackingMode;
      } else if (kind === 'timed') {
        payload.timedActivity = timedActivity.trim();
        payload.timeThresholdSeconds = clockToSeconds(timeThresholdClock);
        // Party gate only makes sense where the plugin can see a party — the raids.
        payload.partySize = activityIsRaid(timedActivity) && timedPartySize.trim()
          ? parseInt(timedPartySize, 10)
          : null;
      } else if (kind === 'deathless') {
        // The raid rides the timedActivity column; requiredAmount = deathless runs needed;
        // an exact party size (optional) rides timeThresholdSeconds, like the LMS cap.
        payload.timedActivity = timedActivity.trim();
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : 1;
        payload.timeThresholdSeconds = deathlessPartySize.trim() ? parseInt(deathlessPartySize, 10) : null;
      } else if (kind === 'lms') {
        // The placement cap rides the timeThresholdSeconds column; requiredAmount = games.
        payload.timeThresholdSeconds = parseInt(lmsPlacementCap, 10);
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : 1;
      } else if (kind === 'value') {
        // The gp threshold rides the requiredAmount column; sources ride sourceNpcs.
        payload.requiredAmount = parseGp(valueGpText);
      }

      if (isDrop || isValue) {
        const npcs = sourceNpcsText.split(',').map((s) => s.trim()).filter(Boolean);
        payload.sourceNpcs = npcs.length > 0 ? npcs : null;
      }
      if (isDrop) {
        // Optional raid party-size gate ("solo Cursed phalanx") — rides timeThresholdSeconds.
        // Only persisted while a raid source backs it; without one the plugin could never
        // know the party size and the tile would silently stop counting.
        payload.timeThresholdSeconds = sourcesIncludeRaid(sourceNpcsText) && dropPartySize.trim()
          ? parseInt(dropPartySize, 10)
          : null;
      }

      // Detached mode: the caller owns the write (library tasks have no event or tile row).
      if (onSave) {
        const saved = await onSave(payload);
        if (saved) {
          setBaseStamp(saved.updatedAt ?? null);
          onSaved(saved);
        } else {
          setError('Could not save — try again.');
        }
        return; // the finally below clears `saving`
      }

      const res = await fetch(`/api/events/${eventId}/tiles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setBaseStamp(updated.updatedAt ?? null);
        onSaved({
          label: updated.label,
          description: updated.description,
          tileType: updated.tileType,
          requiredAmount: updated.requiredAmount,
          trackedStat: updated.trackedStat,
          statType: updated.statType,
          statGoal: updated.statGoal,
          trackingMode: updated.trackingMode,
          optional: !!updated.optional,
          autoTrackDisabled: !!updated.autoTrackDisabled,
          trackedItemIds: updated.trackedItemIds ? JSON.parse(updated.trackedItemIds) : null,
          itemRequirements: updated.itemRequirements ? JSON.parse(updated.itemRequirements) : null,
          points: updated.points ?? 1,
          category: updated.category ?? null,
          sourceNpcs: updated.sourceNpcs ? JSON.parse(updated.sourceNpcs) : null,
          targetNpcs: updated.targetNpcs ? JSON.parse(updated.targetNpcs) : null,
          timedActivity: updated.timedActivity ?? null,
          timeThresholdSeconds: updated.timeThresholdSeconds ?? null,
          partySize: updated.partySize ?? null,
          mission: !!updated.mission,
          missionRules: updated.rules ? parseTileMissionRules(updated.rules) : null,
          updatedAt: updated.updatedAt ?? null,
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          res.status === 409
            ? data.error || 'Someone else saved this tile while you were editing — reopen it to load their version.'
            : data.error || 'Could not save tile.',
        );
      }
    } finally {
      setSaving(false);
    }
  }

  // Light heads-up: a count in the title that doesn't line up with the tile's target amount. Scoped
  // to the field each kind actually uses (statGoal for skill/boss, gp for value, requiredAmount for
  // the count kinds), and only when the target isn't mentioned in the title OR description.
  const amountWarning = useMemo(() => {
    let target: number | null = null;
    if (kind === 'skill' || kind === 'boss') target = parseAmountToken(statGoal);
    else if (kind === 'value') target = parseAmountToken(valueGpText);
    else if (['drop', 'kill', 'pvp', 'gain', 'deathless', 'lms'].includes(kind)) target = parseAmountToken(requiredAmount);
    if (target == null || target <= 0) return null;
    const labelNums = extractCountLikeNumbers(label);
    if (labelNums.length === 0) return null;
    const allNums = [...labelNums, ...extractCountLikeNumbers(description)];
    if (allNums.includes(target)) return null;
    const titleNum = labelNums.find((n) => n !== target) ?? labelNums[0];
    return { titleNum, target };
  }, [kind, label, description, requiredAmount, statGoal, valueGpText]);

  return (
    <div className="space-y-3">
      {/* Admin live-event override — unlocks the normally-frozen fields on a running board. Only
          rendered to admins after the event has started. */}
      {canOverride && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={liveOverride}
              onChange={(e) => setLiveOverride(e.target.checked)}
              className="mt-0.5 accent-amber-400"
            />
            <span className="text-xs text-amber-200 leading-relaxed">
              <span className="font-semibold">🔓 Override live-event lock (admin)</span>
              <span className="block text-amber-200/80 mt-0.5">
                Unlock this tile’s label, kind and required amount to fix a misconfigured tile on the
                running board. The change is recorded as a{' '}
                <span className="font-semibold">live override</span> in the tile history. If you lower a
                required amount, run <span className="font-semibold">Recompute Completions</span> on the
                Overview tab afterwards to heal teams already at the new target.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* Tile kind — the single source of truth for what this tile is */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Tile Kind</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => changeKind(k.key)}
              disabled={locked}
              // Hover any kind (not just the selected one) to read what it does + how it's tracked.
              title={k.blurb}
              className={`px-2.5 py-1.5 text-xs rounded border transition-colors disabled:opacity-50 ${
                kind === k.key
                  ? 'bg-gold/20 border-gold text-gold'
                  : 'border-card-border text-text-muted hover:border-gold/50'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
          {KINDS.find((k) => k.key === kind)?.blurb}
          {locked && ' · Kind is locked after the event starts.'}
        </p>
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Label</label>
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={locked}
          className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
        />
        {locked && <p className="text-[10px] text-text-muted mt-0.5">Cannot change after event start</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground resize-y"
          placeholder="Tile description..."
        />
      </div>

      {/* Light mismatch hint — a number in the title that doesn't match the target amount. */}
      {amountWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-200/90">
          <span aria-hidden>⚠️</span>
          <span>
            The title mentions <strong>{amountWarning.titleNum.toLocaleString()}</strong>, but this tile&apos;s amount is set
            to <strong>{amountWarning.target.toLocaleString()}</strong>. Double-check they should match.
          </span>
        </div>
      )}

      {/* Point value (points events only) — picked by difficulty tier, with the raw number
          alongside for fine-tuning. Choosing a tier sets the band's floor; typing a number
          snaps the tier picker to whichever band it falls in. */}
      {pointsMode && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Difficulty &amp; Points <span className="text-text-muted/60">(score awarded on completion)</span>
          </label>
          <div className="flex gap-2">
            <Select
              className="flex-1"
              ariaLabel="Difficulty tier"
              value={tileTierKey(parseInt(points, 10) || 0, bands) ?? ''}
              onChange={(key) => {
                const band = bands.find((b) => b.key === key);
                if (band) setPoints(String(Math.max(1, band.min)));
              }}
              options={bands.map((b, i) => ({
                value: b.key,
                label: `${b.label} · ${b.min}${i < bands.length - 1 ? `–${bands[i + 1].min - 1}` : '+'} pts`,
                dot: tierColor(i, bands.length),
              }))}
            />
            <Input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              min="0"
              placeholder="e.g. 10"
              className="w-24 shrink-0"
              aria-label="Point value"
            />
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">
            Tiers are your bands from Advanced settings — picking one sets its base points. The exact
            number still decides standings (sum of completed tiles) and can be fine-tuned freely.
          </p>
        </div>
      )}

      {/* Category — a tile can carry several tags (stored comma-separated), so it shows up
          under every matching filter on the board and in the plugin (e.g. Inferno + PvM). */}
      <div>
        <label className="block text-xs text-text-muted mb-1">
          Categories <span className="text-text-muted/60">(tags — Enter or comma adds; a tile can have several, e.g. Inferno + PvM)</span>
        </label>
        <ChipsInput
          value={splitCategories(category)}
          onChange={(tags) => setCategory(tags.join(', '))}
          placeholder="e.g. GWD"
          ariaLabel="Category tags"
          suggestions={categorySuggestions}
        />
      </div>

      {/* ---- STAT KINDS (skill / boss) ---- */}
      {isStat && (
        <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
          {kind === 'skill' ? (
            <div>
              <label className="block text-xs text-text-muted mb-1">Skill</label>
              <Select
                value={trackedStat}
                onChange={setTrackedStat}
                placeholder="Select a skill..."
                ariaLabel="Skill"
                options={SKILLS.map((key) => ({ value: key, label: SKILL_LABELS[key] || key, keywords: SKILL_ALIASES[key] }))}
              />
            </div>
          ) : (
            /* Boss KC can track SEVERAL hiscores bosses on one tile — gains sum across them
               (CoX + CoX: CM, or all four GWD bosses). Stored comma-separated in trackedStat. */
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Boss(es) <span className="text-text-muted/60">(KC gains sum across all listed)</span>
              </label>
              {statKeys(trackedStat).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {statKeys(trackedStat).map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-gold/15 border border-gold/30 text-gold"
                    >
                      {BOSSES.find((b) => b.key === key)?.label ?? key}
                      <button
                        type="button"
                        onClick={() => setTrackedStat(statKeys(trackedStat).filter((k) => k !== key).join(','))}
                        className="text-red-400 hover:text-red-300 flex-shrink-0"
                        aria-label={`Remove ${BOSSES.find((b) => b.key === key)?.label ?? key}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Select
                value=""
                onChange={(key) => {
                  if (!key) return;
                  const keys = statKeys(trackedStat);
                  if (!keys.includes(key)) setTrackedStat([...keys, key].join(','));
                }}
                placeholder={statKeys(trackedStat).length > 0 ? 'Add another boss...' : 'Select a boss...'}
                ariaLabel="Boss"
                options={BOSSES.filter((b) => !statKeys(trackedStat).includes(b.key)).map((b) => ({ value: b.key, label: b.label, keywords: b.aliases }))}
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                Add more than one to combine modes — e.g. <span className="text-foreground/70">Chambers of Xeric</span> +{' '}
                <span className="text-foreground/70">CoX: CM</span> counts clears of either toward the goal.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs text-text-muted mb-1">Goal ({kind === 'skill' ? 'XP' : 'KC'})</label>
            <Input
              type="number"
              value={statGoal}
              onChange={(e) => setStatGoal(e.target.value)}
              placeholder={kind === 'skill' ? 'e.g. 1000000' : 'e.g. 100'}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Tracking Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackingMode("team")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "team" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Team Total
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("individual")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "individual" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Solo (Any Member)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- DROP KINDS (drop / collection) ---- */}
      {isDrop && (
        <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
          {kind === 'drop' && (
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Required Amount <span className="text-text-muted/60">(any tracked item counts)</span>
              </label>
              <Input
                type="number"
                value={requiredAmount}
                onChange={(e) => setRequiredAmount(e.target.value)}
                disabled={locked}
                placeholder="e.g. 10"
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
                min="1"
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                Total drops needed across all tracked items combined. E.g. &ldquo;10 uniques from any GWD boss&rdquo;.
              </p>
            </div>
          )}

          {isCollection && trackedItems.length > 0 && (
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Total Required <span className="text-text-muted/60">(auto-computed)</span>
              </label>
              <div className="px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground/60">
                {(() => {
                  const groups = new Map<string, number>();
                  let ungrouped = 0;
                  for (const i of trackedItems) {
                    const g = i.group?.trim().toLowerCase();
                    if (g) groups.set(g, (groups.get(g) ?? 0) + i.perItemAmount);
                    else ungrouped += i.perItemAmount;
                  }
                  if (groups.size === 0) return ungrouped;
                  return `${ungrouped + Math.min(...groups.values())} (smallest set of ${groups.size})`;
                })()}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-text-muted mb-1">
              {isCollection ? 'Set Items (count per item)' : 'Tracked Items'}
              <span className="text-text-muted/60 ml-1">(RuneLite plugin auto-detects these drops)</span>
            </label>

            {trackedItems.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {trackedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded bg-accent-green/15 border border-accent-green/30 text-accent-green-light"
                  >
                    <span className="flex-1 min-w-0 truncate">
                      {item.name}
                      <span className="text-text-muted/60 ml-1">#{item.id}</span>
                    </span>
                    {isCollection && (
                      <>
                        <Input
                          type="text"
                          value={item.group ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTrackedItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, group: val } : i)));
                          }}
                          maxLength={30}
                          placeholder="set"
                          className="w-24 px-1.5 py-0.5 bg-brown-dark border border-card-border rounded text-xs text-foreground"
                          title='Set name for "any full set" tiles — items sharing a set complete together; one whole set finishes the tile. Blank = always required.'
                        />
                        <NumberInput
                          value={item.perItemAmount}
                          onChange={(val) => {
                            setTrackedItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, perItemAmount: val } : i)));
                          }}
                          min={1}
                          fallback={1}
                          className="w-14 px-1.5 py-0.5 bg-brown-dark border border-card-border rounded text-xs text-foreground text-center"
                          aria-label="Required amount for this item"
                        />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setTrackedItems((prev) => prev.filter((i) => i.id !== item.id))}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isCollection && trackedItems.length > 1 && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() =>
                    setTrackedItems((prev) => prev.map((i) => ({ ...i, group: i.name.split(' ')[0] })))
                  }
                  className="text-[10px] px-2 py-1 rounded border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
                  title="Fill each item's set from the first word of its name (Dharok's, Ahrim's, Blood, …)"
                >
                  Auto-set by name prefix
                </button>
                <span className="text-[10px] text-text-muted leading-tight">
                  Sets make this an <span className="text-gold">any-one-set</span> tile: one complete set finishes it
                  (no mixing). Blank = item always required.
                </span>
              </div>
            )}

            <div ref={itemSearchRef} className="relative">
              <Input
                type="text"
                value={itemSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemSearch(val);
                  setShowItemDropdown(true);
                  if (searchTimeout.current) clearTimeout(searchTimeout.current);
                  searchTimeout.current = setTimeout(() => searchItems(val), 300);
                }}
                onFocus={() => itemResults.length > 0 && setShowItemDropdown(true)}
                placeholder="Search by name or item ID (e.g. Pet zilyana, 12651)..."
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              />
              {itemSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">...</span>}
              {showItemDropdown && itemResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-brown-dark border border-card-border rounded shadow-lg">
                  {itemResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTrackedItems((prev) => [...prev, { ...item, perItemAmount: 1 }]);
                        setItemSearch("");
                        setItemResults([]);
                        setShowItemDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gold/10 transition-colors flex justify-between items-center"
                    >
                      <span className="text-foreground">{item.name}</span>
                      <span className="text-text-muted/60 text-xs">#{item.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {trackedItems.length === 0 && (
              <p className="text-[10px] text-text-muted mt-1">
                {isCollection
                  ? 'Add each item in the set — every one needs its own count to complete the tile.'
                  : 'Optional: add specific item drops the plugin should auto-detect. Leave empty to count any submitted drop.'}
              </p>
            )}
          </div>

          {/* Source restriction — count the drop only from these sources (NPC, raid, or chest). */}
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Restrict to source(s) <span className="text-text-muted/60">(optional)</span>
            </label>
            <Combobox
              value={sourceNpcsText}
              onChange={setSourceNpcsText}
              suggestions={sourceSuggestions}
              multi
              placeholder="e.g. Zulrah, Chambers of Xeric, Barrows"
              ariaLabel="Source restriction"
            />
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              Comma-separated. The drop only counts when it comes from one of these (case-insensitive). Leave blank to
              accept any source.
              <br />
              • <span className="text-foreground/70">Direct kills</span> → the NPC name (e.g. Zulrah, Vorkath, Nex).
              <br />
              • <span className="text-foreground/70">Raids &amp; chest loot</span> → the raid/chest name, not the room
              boss — Chambers of Xeric, Theatre of Blood, Tombs of Amascut, Barrows, Lunar Chest (Moons). The game
              reports the chest as the source, so an &ldquo;onyx from CoX&rdquo; tile uses{' '}
              <span className="text-foreground/70">Chambers of Xeric</span>.
              <br />
              • <span className="text-foreground/70">Loot keys</span> → <span className="text-foreground/70">Loot Chest</span> —
              a specific item pulled from an opened PK loot key (use a Loot value tile for &ldquo;any key worth X&rdquo;).
            </p>
          </div>

          {/* Raid party-size gate — only appears once a raid is named as a source, since party
              size is only knowable inside a raid instance. Rides timeThresholdSeconds on the wire
              (drop tiles carry no time cap). "solo Cursed phalanx" = 1. */}
          {sourcesIncludeRaid(sourceNpcsText) && (
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Party size <span className="text-text-muted/60">(optional — blank = any size)</span>
              </label>
              <Input
                type="number"
                value={dropPartySize}
                onChange={(e) => setDropPartySize(e.target.value)}
                placeholder="any"
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                min="1"
                max="100"
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                Require exactly this many players in the raid — <span className="text-foreground/70">1 = solo</span>{' '}
                (e.g. a solo Cursed phalanx from ToA — invocation is Jagex&rsquo;s guarantee, so the tile only
                gates party size). The plugin reads the raid&rsquo;s party size from the game, so a split team
                still counts correctly. Blank = any size.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- GAIN KIND (catch/cook/gather — counted from inventory gains) ---- */}
      {isGain && (
        <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Required Amount</label>
            <Input
              type="number"
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              disabled={locked}
              placeholder="e.g. 100"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
              min="1"
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              Total gains needed across all tracked items combined — e.g. &ldquo;catch 100 raw karambwan&rdquo;.
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Tracked Items
              <span className="text-text-muted/60 ml-1">(the plugin counts these appearing in the inventory)</span>
            </label>
            {trackedItems.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {trackedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded bg-accent-green/15 border border-accent-green/30 text-accent-green-light"
                  >
                    <span className="flex-1 min-w-0 truncate">
                      {item.name}
                      <span className="text-text-muted/60 ml-1">#{item.id}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTrackedItems((prev) => prev.filter((i) => i.id !== item.id))}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div ref={itemSearchRef} className="relative">
              <Input
                type="text"
                value={itemSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemSearch(val);
                  setShowItemDropdown(true);
                  if (searchTimeout.current) clearTimeout(searchTimeout.current);
                  searchTimeout.current = setTimeout(() => searchItems(val), 300);
                }}
                onFocus={() => itemResults.length > 0 && setShowItemDropdown(true)}
                placeholder="Search by name or item ID (e.g. Raw karambwan)..."
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              />
              {itemSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">...</span>}
              {showItemDropdown && itemResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-brown-dark border border-card-border rounded shadow-lg">
                  {itemResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTrackedItems((prev) => [...prev, { ...item, perItemAmount: 1 }]);
                        setItemSearch("");
                        setItemResults([]);
                        setShowItemDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gold/10 transition-colors flex justify-between items-center"
                    >
                      <span className="text-foreground">{item.name}</span>
                      <span className="text-text-muted/60 text-xs">#{item.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
              Counts items appearing in the inventory — fishing catches, cooked food, jarred implings. Gains
              while the bank, GE, deposit box, or a trade is open don&rsquo;t count, and the plugin bakes the
              running total onto a screenshot like kill tiles.
            </p>
          </div>
        </div>
      )}

      {/* ---- KILL KIND ---- */}
      {isKill && (
        <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Target NPC(s) <span className="text-text-muted/60">(any listed name counts)</span>
            </label>

            {/* Selected NPC chips */}
            {targetNpcNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {targetNpcNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-accent-green/15 border border-accent-green/30 text-accent-green-light"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => removeNpc(name)}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                      aria-label={`Remove ${name}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search + free-text add. Enter adds the typed text verbatim (override). */}
            <div ref={npcSearchRef} className="relative">
              <Input
                type="text"
                value={npcSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setNpcSearch(val);
                  setShowNpcDropdown(true);
                  if (npcSearchTimeout.current) clearTimeout(npcSearchTimeout.current);
                  npcSearchTimeout.current = setTimeout(() => searchNpcs(val), 300);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && npcSearch.trim()) {
                    e.preventDefault();
                    addNpc(npcSearch);
                    setNpcSearch('');
                    setNpcResults([]);
                    setShowNpcDropdown(false);
                  }
                }}
                onFocus={() => npcResults.length > 0 && setShowNpcDropdown(true)}
                placeholder="Search monsters (e.g. Nightmare, Chicken)..."
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              />
              {npcSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">...</span>}
              {showNpcDropdown && npcResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-brown-dark border border-card-border rounded shadow-lg">
                  <button
                    type="button"
                    onClick={addAllNpcResults}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-gold border-b border-card-border hover:bg-gold/10 transition-colors"
                  >
                    + Add all {npcResults.length} match{npcResults.length !== 1 ? 'es' : ''}
                  </button>
                  {npcResults.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        addNpc(name);
                        setNpcSearch('');
                        setNpcResults([]);
                        setShowNpcDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-gold/10 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              A kill counts when the NPC&rsquo;s name matches <span className="text-foreground/70">any</span> of these
              (case-insensitive). Add every variant you want to count — e.g. <span className="text-foreground/70">The
              Nightmare</span> + <span className="text-foreground/70">Phosani&rsquo;s Nightmare</span>, or use
              &ldquo;Add all matches&rdquo;. These need not be on the hiscores (chickens, cows, etc.). Press Enter to add a
              name that isn&rsquo;t in the list — the plugin&rsquo;s reported name is the source of truth.
            </p>

            {/* Raid quick-adds — completions credit off the game's kill-count line, which names the
                mode exactly. To count both normal and CM/Hard/Expert on one tile, add both strings. */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Raids</span>
              {RAID_KC_NAMES.filter((n) => !targetNpcNames.some((t) => t.toLowerCase() === n.toLowerCase())).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addNpc(n)}
                  className="text-[10px] px-2 py-0.5 rounded border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
                  title="Add this raid mode — the completion counts off the in-game count line"
                >
                  + {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Required Kills</label>
            <Input
              type="number"
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              disabled={locked}
              placeholder="e.g. 50"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Tracking Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackingMode("team")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "team" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Team Total
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("individual")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "individual" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Solo (Any Member)
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              Team Total sums every member&rsquo;s kills; Solo completes when any one member reaches the count.
            </p>
          </div>
        </div>
      )}

      {/* ---- PVP KILL KIND ---- */}
      {isPvp && (
        <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Who counts as a target?</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPvpTargetMode('anyone')}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  pvpTargetMode === 'anyone' ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                }`}
              >
                Anyone
              </button>
              <button
                type="button"
                onClick={() => setPvpTargetMode('other-team')}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  pvpTargetMode === 'other-team' ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                }`}
              >
                Rival team
              </button>
              <button
                type="button"
                onClick={() => setPvpTargetMode('rsn')}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  pvpTargetMode === 'rsn' ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                }`}
              >
                Specific player(s)
              </button>
            </div>
            {pvpTargetMode === 'anyone' && (
              <p className="text-[10px] text-text-muted mt-2">
                <span className="text-foreground/70">Any</span> player kill counts — no team or bounty list. The
                victim doesn&rsquo;t need to be in the event. (Still dangerous-PvP only; safe minigames never count.)
              </p>
            )}
            {pvpTargetMode === 'rsn' && (
              <div className="mt-2">
                <Input
                  type="text"
                  value={pvpRsnsText}
                  onChange={(e) => setPvpRsnsText(e.target.value)}
                  placeholder="e.g. Zezima, B0aty"
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
                <p className="text-[10px] text-text-muted mt-0.5">
                  Comma-separated RSNs — killing <span className="text-foreground/70">any</span> listed player counts
                  (case-insensitive). A bounty target doesn&rsquo;t have to be signed up for the event.
                </p>
              </div>
            )}
            <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed">
              Kills only count in <span className="text-foreground/70">dangerous PvP</span> — the Wilderness or PvP
              worlds. Safe minigames (LMS, Soul Wars, Castle Wars, PvP Arena) never count. Exactly one player credits
              per kill: whoever the game awards it to (the one who gets the loot / loot key). Rival-team kills need
              the victim signed up on another team in this event.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Required Kills</label>
            <Input
              type="number"
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              disabled={locked}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Minimum loot value (optional)</label>
            <Input
              type="text"
              value={pvpMinLootText}
              onChange={(e) => setPvpMinLootText(e.target.value)}
              placeholder="e.g. 10k — leave blank for none"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
            />
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              Only credit a kill worth at least this much loot (accepts <span className="text-foreground/70">10k</span>,{' '}
              <span className="text-foreground/70">5m</span>). Blank = every kill counts. A value here means
              the plugin waits to price the loot, so <span className="text-foreground/70">loot-key kills won&rsquo;t
              count</span> for this tile.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Tracking Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackingMode("team")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "team" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Team Total
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("individual")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "individual" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Solo (Any Member)
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              Team Total sums every member&rsquo;s PvP kills; Solo completes when any one member reaches the count.
            </p>
          </div>
        </div>
      )}

      {/* ---- DIARY KIND ---- */}
      {isDiary && (
        <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Diaries that count <span className="text-text-muted/60">(any listed one counts)</span>
            </label>

            {diarySelectors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {diarySelectors.map((sel) => (
                  <span
                    key={sel}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-accent-green/15 border border-accent-green/30 text-accent-green-light"
                  >
                    {sel}
                    <button
                      type="button"
                      onClick={() => setDiarySelectors((prev) => prev.filter((s) => s !== sel))}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                      aria-label={`Remove ${sel}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Select
                value={diaryArea}
                onChange={setDiaryArea}
                ariaLabel="Diary area"
                className="flex-1"
                options={[
                  { value: DIARY_ANY, label: 'Any area' },
                  ...DIARY_AREAS.map((a) => ({ value: a, label: a })),
                ]}
              />
              <Select
                value={diaryTier}
                onChange={setDiaryTier}
                ariaLabel="Diary tier"
                className="w-32"
                options={[
                  { value: DIARY_ANY, label: 'Any tier' },
                  ...DIARY_TIERS.map((t) => ({ value: t, label: t })),
                ]}
              />
              <button
                type="button"
                onClick={() => {
                  const sel = `${diaryArea} ${diaryTier}`;
                  setDiarySelectors((prev) => (prev.includes(sel) ? prev : [...prev, sel]));
                }}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded border border-gold/40 bg-gold/15 text-gold hover:bg-gold/25 transition-colors"
              >
                + Add
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              A completion counts when the in-game &ldquo;completed all of the &lt;tier&gt; tasks&rdquo; message matches{' '}
              <span className="text-foreground/70">any</span> selector. &ldquo;Any Elite&rdquo; = any area&rsquo;s elite
              diary; &ldquo;Wilderness Any&rdquo; = any Wilderness tier. The message only fires at the moment a tier is
              finished — diaries completed before the event can&rsquo;t re-trigger it.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Required Completions</label>
            <Input
              type="number"
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              disabled={locked}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Tracking Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackingMode("team")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "team" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Team Total
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("individual")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "individual" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Solo (Any Member)
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              Team Total sums every member&rsquo;s completions; Solo completes when any one member reaches the count.
            </p>
          </div>
        </div>
      )}

      {/* ---- COMBAT ACHIEVEMENT KIND ---- */}
      {isCa && (
        <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Combat tasks that count <span className="text-text-muted/60">(any listed one counts)</span>
            </label>

            {caSelectors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {caSelectors.map((sel) => (
                  <span
                    key={sel}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-accent-green/15 border border-accent-green/30 text-accent-green-light"
                  >
                    {sel}
                    <button
                      type="button"
                      onClick={() => setCaSelectors((prev) => prev.filter((s) => s !== sel))}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                      aria-label={`Remove ${sel}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Task search over the bundled wiki dataset. Enter adds the typed text verbatim
                (override for tasks newer than the bundle). */}
            <div ref={caSearchRef} className="relative">
              <Input
                type="text"
                value={caSearch}
                onChange={(e) => {
                  setCaSearch(e.target.value);
                  setShowCaDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && caSearch.trim()) {
                    e.preventDefault();
                    const typed = caSearch.trim();
                    setCaSelectors((prev) =>
                      prev.some((s) => s.toLowerCase() === typed.toLowerCase()) ? prev : [...prev, typed],
                    );
                    setCaSearch('');
                    setShowCaDropdown(false);
                  }
                }}
                onFocus={() => caResults.length > 0 && setShowCaDropdown(true)}
                placeholder="Search tasks by name or monster (e.g. Whack-a-Mole, Zulrah)..."
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              />
              {isCa && caTasks === null && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">...</span>}
              {showCaDropdown && caResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-brown-dark border border-card-border rounded shadow-lg">
                  {caResults.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        setCaSelectors((prev) =>
                          prev.some((s) => s.toLowerCase() === t.name.toLowerCase()) ? prev : [...prev, t.name],
                        );
                        setCaSearch('');
                        setShowCaDropdown(false);
                      }}
                      className="w-full flex items-baseline justify-between gap-2 text-left px-3 py-2 text-sm text-foreground hover:bg-gold/10 transition-colors"
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="shrink-0 text-[10px] text-text-muted">
                        {t.tier}{t.monster ? ` · ${t.monster}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tier wildcard — "Any Master" counts every task of that tier. */}
            <div className="flex gap-2 mt-2">
              <Select
                value={caTier}
                onChange={setCaTier}
                ariaLabel="Combat Achievement tier"
                className="flex-1"
                options={CA_TIERS.map((t) => ({ value: t, label: `Any ${t} task` }))}
              />
              <button
                type="button"
                onClick={() => {
                  const sel = `Any ${caTier}`;
                  setCaSelectors((prev) => (prev.includes(sel) ? prev : [...prev, sel]));
                }}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded border border-gold/40 bg-gold/15 text-gold hover:bg-gold/25 transition-colors"
              >
                + Add
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              A completion counts when the in-game &ldquo;you&rsquo;ve completed a &lt;tier&gt; combat task&rdquo;
              message matches <span className="text-foreground/70">any</span> selector — an exact task name or
              &ldquo;Any &lt;tier&gt;&rdquo;. Players who already own a task can re-trigger the message by enabling{' '}
              <span className="text-foreground/70">Settings &rarr; Combat Achievements &rarr; Repeat completion</span>{' '}
              and meeting the task&rsquo;s conditions again during the event.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Required Completions</label>
            <Input
              type="number"
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              disabled={locked}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Tracking Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackingMode("team")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "team" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Team Total
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("individual")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "individual" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
                }`}
              >
                Solo (Any Member)
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              Team Total sums every member&rsquo;s task completions; Solo completes when any one member reaches the count.
            </p>
          </div>
        </div>
      )}

      {/* ---- TIMED KIND ---- */}
      {isTimed && (
        <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Activity</label>
            <Combobox
              value={timedActivity}
              onChange={setTimedActivity}
              suggestions={TIMED_ACTIVITY_SUGGESTIONS}
              placeholder="e.g. Inferno"
              maxLength={60}
              ariaLabel="Timed activity"
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              The activity the plugin times (region/boss it recognises). Raids, Inferno, Colosseum, or a boss.
              For raids, the base name (e.g. <span className="text-foreground/70">Chambers of Xeric</span>) counts a
              clear of <span className="text-foreground/70">any mode</span> — normal and CM/Hard/Expert alike. Pick a
              mode-specific entry (e.g. <span className="text-foreground/70">Chambers of Xeric Challenge Mode</span>)
              to count only that mode.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Time Cap <span className="text-text-muted/60">(complete if cleared at or under)</span>
            </label>
            <Input
              type="text"
              value={timeThresholdClock}
              onChange={(e) => setTimeThresholdClock(e.target.value)}
              placeholder="mm:ss — e.g. 30:00"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              Enter as <span className="text-foreground/70">mm:ss</span> (e.g. 30:00) or seconds. Pass/fail — the tile
              completes when a submitted clear time is at or under this cap.
            </p>
          </div>

          {/* Party gate — only raids expose a party the plugin can count. */}
          {activityIsRaid(timedActivity) && (
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Party size <span className="text-text-muted/60">(optional — blank = any size)</span>
              </label>
              <Input
                type="number"
                value={timedPartySize}
                onChange={(e) => setTimedPartySize(e.target.value)}
                placeholder="any"
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                min="1"
                max="100"
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                Require exactly this many players in the raid (e.g. 5 for a 5-man ToB speedrun). The plugin
                reads the raid&rsquo;s party size from the game, so a split team still counts correctly.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- DEATHLESS KIND (raid with zero party deaths) ---- */}
      {isDeathless && (
        <div className="space-y-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Raid</label>
            <Combobox
              value={timedActivity}
              onChange={setTimedActivity}
              suggestions={DEATHLESS_ACTIVITY_SUGGESTIONS}
              placeholder="e.g. Theatre of Blood"
              ariaLabel="Deathless raid activity"
            />
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              The plugin counts every player death inside the raid instance and credits a run only when the
              completion message arrives with zero deaths. Note: if the runner disconnects mid-raid, deaths
              during the disconnect are missed — the baked screenshot is the audit trail. The base raid name
              counts <span className="text-foreground/70">any mode</span> (normal and CM/Hard/Expert — Entry
              never counts against a base tile); a mode-specific entry counts only that mode.
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Deathless runs needed</label>
            <Input
              type="number"
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              disabled={locked}
              placeholder="1"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
              min="1"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Party size <span className="text-text-muted/60">(optional — blank = any size)</span>
            </label>
            <Input
              type="number"
              value={deathlessPartySize}
              onChange={(e) => setDeathlessPartySize(e.target.value)}
              placeholder="any"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              min="1"
              max="100"
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              Require exactly this many players in the raid (e.g. 5 for a 5-man ToB). The plugin reads
              the raid&rsquo;s party size from the game, so a split team still counts correctly.
            </p>
          </div>
        </div>
      )}

      {/* ---- LMS KIND ---- */}
      {isLms && (
        <div className="space-y-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Placement Cap <span className="text-text-muted/60">(1 = must win; 3 = top-3 counts)</span>
            </label>
            <Input
              type="number"
              min={1}
              max={24}
              value={lmsPlacementCap}
              onChange={(e) => setLmsPlacementCap(e.target.value)}
              placeholder="1"
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              The plugin watches Last Man Standing and submits a baked screenshot whenever the player
              finishes at or above this placement (survivors left when they fall; winning is 1st).
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Games Required <span className="text-text-muted/60">(qualifying games to complete the tile)</span>
            </label>
            <Input
              type="number"
              min={1}
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              placeholder="1"
            />
          </div>
        </div>
      )}

      {/* ---- VALUE KIND ---- */}
      {isValue && (
        <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setValueMode('single')}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  valueMode === 'single' ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                }`}
              >
                Single haul
              </button>
              <button
                type="button"
                onClick={() => setValueMode('total')}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  valueMode === 'total' ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                }`}
              >
                Collect total
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              Single haul: one drop/key/kill worth the full amount. Collect total: every haul&rsquo;s
              value adds up until the team reaches it.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              {valueMode === 'total' ? 'Target Value' : 'Haul Value'}{' '}
              <span className="text-text-muted/60">
                {valueMode === 'total' ? '(hauls sum to at least this)' : '(one drop/haul worth at least this)'}
              </span>
            </label>
            <Input
              type="text"
              value={valueGpText}
              onChange={(e) => setValueGpText(e.target.value)}
              placeholder="e.g. 5m"
              aria-label="Haul value threshold"
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              The plugin prices every loot haul (drops, loot keys, PvP kills) and submits it with a
              baked screenshot. Accepts 5m / 500k / raw gp.
            </p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Restrict to source(s) <span className="text-text-muted/60">(optional)</span>
            </label>
            <Combobox
              value={sourceNpcsText}
              onChange={setSourceNpcsText}
              suggestions={valueSourceSuggestions}
              multi
              placeholder="e.g. PvP, Loot Chest, Vorkath"
              ariaLabel="Value source restriction"
            />
            <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
              Comma-separated. <span className="text-foreground/70">PvP</span> = loot from killing another
              player, <span className="text-foreground/70">Loot Chest</span> = opened loot keys; otherwise an
              NPC/chest name. Leave blank to accept a qualifying haul from anywhere.
            </p>
          </div>
        </div>
      )}

      {/* Optional toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOptional(!optional)}
          className={`relative w-10 h-5 rounded-full transition-colors ${optional ? 'bg-gold' : 'bg-card-border'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${optional ? 'translate-x-5' : ''}`}
          />
        </button>
        <span className="text-xs text-text-muted">Optional tile (doesn&apos;t count towards total)</span>
      </div>

      {/* ---- MISSION — a hidden tile announced mid-event with its own scoring ---- */}
      <div className="rounded-lg border border-gold/25 bg-gold/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMission(!mission)}
            aria-pressed={mission}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${mission ? 'bg-gold' : 'bg-card-border'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${mission ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-xs text-foreground font-medium">⚡ Mission (hidden until announced mid-event)</span>
        </div>
        {mission && (
          <div className="space-y-3 pl-1">
            <p className="text-[10px] text-text-muted leading-relaxed">
              This tile stays hidden until you announce it — manually, or on the cadence set in the event&apos;s
              Mission settings — then drops live with the scoring below.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMissionLockout(!missionLockout)}
                aria-pressed={missionLockout}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${missionLockout ? 'bg-gold' : 'bg-card-border'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${missionLockout ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-xs text-text-muted">First team to clear locks it (others can&apos;t score it)</span>
            </div>
            {!pointsMode && (
              <p className="text-[10px] text-amber-300/80">
                Bonus &amp; decay only change points — switch the event to points scoring to use them. Lockout &amp; expiry still work.
              </p>
            )}
            <div>
              <label className="block text-xs text-text-muted mb-1">
                First-clear bonus <span className="text-text-muted/60">(extra points for the first team)</span>
              </label>
              <Input
                type="number"
                value={missionFirstBonus}
                onChange={(e) => setMissionFirstBonus(e.target.value)}
                min="0"
                placeholder="e.g. 500"
                disabled={!pointsMode}
                className="w-32"
                aria-label="First-clear bonus"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Value over time</label>
              <div className="flex gap-1.5 mb-1.5">
                {(['off', 'decay', 'grow'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMissionDecayMode(m)}
                    disabled={!pointsMode}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors disabled:opacity-40 ${missionDecayMode === m ? 'bg-gold text-brown-dark' : 'bg-card-border/40 text-text-muted'}`}
                  >
                    {m === 'off' ? 'Flat' : m === 'decay' ? 'Decays' : 'Grows'}
                  </button>
                ))}
              </div>
              {missionDecayMode !== 'off' && (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span>{missionDecayMode === 'grow' ? 'up to' : 'down to'}</span>
                  <Input
                    type="number"
                    value={missionDecayTargetPct}
                    onChange={(e) => setMissionDecayTargetPct(e.target.value)}
                    min="0"
                    placeholder={missionDecayMode === 'grow' ? '200' : '50'}
                    disabled={!pointsMode}
                    className="w-20"
                    aria-label="Value target percent"
                  />
                  <span>% over</span>
                  <Input
                    type="number"
                    value={missionDecayHours}
                    onChange={(e) => setMissionDecayHours(e.target.value)}
                    min="1"
                    placeholder="6"
                    disabled={!pointsMode}
                    className="w-16"
                    aria-label="Value ramp hours"
                  />
                  <span>h</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Auto-expire <span className="text-text-muted/60">(closes if unclaimed; blank = stays open)</span>
              </label>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>after</span>
                <Input
                  type="number"
                  value={missionExpiryHours}
                  onChange={(e) => setMissionExpiryHours(e.target.value)}
                  min="1"
                  placeholder="none"
                  className="w-20"
                  aria-label="Auto-expire hours"
                />
                <span>hours</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auto-tracking kill-switch — only meaningful for kinds the site would otherwise
          auto-credit. 'standard' tiles are already manual, so hiding it there avoids noise. */}
      {kind !== 'standard' && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoTrackDisabled(!autoTrackDisabled)}
              aria-pressed={autoTrackDisabled}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${autoTrackDisabled ? 'bg-amber-500' : 'bg-card-border'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoTrackDisabled ? 'translate-x-5' : ''}`}
              />
            </button>
            <span className="text-xs text-foreground">Disable auto-tracking (complete manually)</span>
          </div>
          <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed">
            {autoTrackDisabled
              ? 'Off the auto-credit path: hiscores polling and plugin submissions are ignored for completing this tile — a captain or admin marks it done manually. Submissions still arrive as evidence. Use when a tile’s tracking is broken.'
              : 'Normally auto-credited. Turn this on if the tile’s tracking is broken so it can be completed manually instead. Editable any time, even after the event starts.'}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 text-sm font-semibold rounded bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Configuration"}
      </button>
    </div>
  );
}
