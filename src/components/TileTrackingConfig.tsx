"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SKILLS, SKILL_LABELS, SKILL_ALIASES, BOSSES, DIARY_AREAS, DIARY_TIERS } from "@/lib/constants";
import Select from '@/components/Select';
import Input from '@/components/Input';
import Combobox from '@/components/Combobox';
import ChipsInput from '@/components/ChipsInput';
import Textarea from '@/components/Textarea';
import { splitCategories, tileTierKey, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import type { TileConfig } from '@/lib/types';

interface Props {
  tileId: number;
  eventId: number;
  initial: TileConfig;
  onSaved: (updated: TileConfig) => void;
  eventStarted?: boolean;
  pointsMode?: boolean;
  /** Admin-configured difficulty bands — drives the tier picker on the points field. */
  tierBands?: TierBand[];
}

// A tile is exactly ONE kind. The kind decides which fields are meaningful — the form
// shows only those, and switching kind clears the others so the data model can never
// hold a nonsensical combo (e.g. a 10M-XP goal on a drop tile).
type TileKind = 'standard' | 'skill' | 'boss' | 'drop' | 'collection' | 'kill' | 'timed' | 'lms' | 'value' | 'diary';

const KINDS: { key: TileKind; label: string; blurb: string }[] = [
  { key: 'standard', label: 'Standard', blurb: 'Manual tile — a captain marks it done. No auto-tracking.' },
  { key: 'skill', label: 'Skill XP', blurb: 'Auto-completes when a skill reaches an XP goal (hiscores-polled).' },
  { key: 'boss', label: 'Boss KC', blurb: 'Auto-completes when a boss reaches a kill-count goal (hiscores-polled).' },
  { key: 'drop', label: 'Item drop', blurb: 'N drops of an item (or any of a pool) — players submit evidence.' },
  { key: 'collection', label: 'Collection', blurb: 'A set where each listed item needs its own count (e.g. full Moons).' },
  { key: 'kill', label: 'Kill count', blurb: 'N kills of an NPC — even ones not on the hiscores (chickens, cows). Plugin-detected, baked screenshot.' },
  { key: 'timed', label: 'Timed clear', blurb: 'Clear an activity under a time cap (Inferno, raids, Colosseum). Plugin times it and bakes the result.' },
  { key: 'lms', label: 'LMS placement', blurb: 'Place top-N in Last Man Standing (1 = win), M times. Plugin-detected at game end, baked screenshot.' },
  { key: 'value', label: 'Loot value', blurb: 'Loot worth X gp — one big haul, or hauls summing to a target. Loot keys, PvP kills, any drop. Plugin prices the haul and bakes proof.' },
  { key: 'diary', label: 'Diary', blurb: 'Complete achievement-diary tiers during the event — a specific diary or any diary of a tier. Plugin-detected off the completion message.' },
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
  'CoX: CM': 'Chambers of Xeric: Challenge Mode',
  'ToB: HM': 'Theatre of Blood: Hard Mode',
  'ToA: Expert': 'Tombs of Amascut: Expert Mode',
  'The Leviathan': 'Leviathan',       // "Your Leviathan kill count is: N" — no article
  'The Whisperer': 'Whisperer',
  'The Hueycoatl': 'Hueycoatl',
  'The Royal Titans': 'Royal Titans',
  'Lunar Chests': null,    // Moons of Peril has no timer — a chest count line, no duration to pair
  'Wintertodt': null,      // no duration line
  'Zalcano': null,         // no in-game kill timer
};
const TIMED_ACTIVITY_SUGGESTIONS = [
  // Named activities first — the usual phrasing on timed tiles.
  'Inferno',
  'Fight Caves',
  'Fortis Colosseum',
  'TzHaar-Ket-Rak',
  // Non-boss timed content the plugin parses: Sailing's Barracuda Trials ("Time: 6:04.20"
  // flanked by lines naming the course; 'Barracuda Trials' matches any course via the
  // plugin's alias table) and Hallowed Sepulchre ("Overall time:" on the exit).
  'Barracuda Trials',
  'Tempor Tantrum',
  'Jubbly Jive',
  'Gwenith Glide',
  'Hallowed Sepulchre',
  ...BOSSES
    .map((b) => (b.label in TIMED_LABEL_FIXES ? TIMED_LABEL_FIXES[b.label] : b.label))
    .filter((s): s is string => !!s),
];

// Autocomplete hints for the source filter. These are the source NAMES the RuneLite plugin
// reports — raid/chest loot uses the chest name (not the room boss), direct kills use the NPC
// name. Not exhaustive; the field accepts any free-text name.
const SOURCE_SUGGESTIONS = [
  'Chambers of Xeric',
  'Theatre of Blood',
  'Tombs of Amascut',
  'Barrows',
  'Lunar Chest',
  'Fortis Colosseum',
  'Hallowed Sepulchre',
  'Zulrah',
  'Vorkath',
  'Nex',
  'Alchemical Hydra',
  'The Nightmare',
  "Phosani's Nightmare",
  'Cerberus',
  'Corrupted Hunllef',
];

// Source hints for loot-value tiles — the specials first ("PvP" = player-kill loot,
// "Loot Chest" = opened loot keys), then the usual drop sources.
const VALUE_SOURCE_SUGGESTIONS = ['PvP', 'Loot Chest', ...SOURCE_SUGGESTIONS];

function deriveKind(initial: TileConfig): TileKind {
  if (initial.tileType === 'drop') {
    return initial.itemRequirements && initial.itemRequirements.length > 0 ? 'collection' : 'drop';
  }
  if (initial.tileType === 'kill') return 'kill';
  if (initial.tileType === 'timed') return 'timed';
  if (initial.tileType === 'lms') return 'lms';
  if (initial.tileType === 'value' || initial.tileType === 'valuetotal') return 'value';
  if (initial.tileType === 'diary') return 'diary';
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

export default function TileTrackingConfig({
  tileId,
  eventId,
  initial,
  onSaved,
  eventStarted,
  pointsMode,
  tierBands,
}: Props) {
  // Difficulty bands, ascending — the tier picker sets points to a band's floor, and the
  // current points value maps back to whichever band it falls in.
  const bands = (tierBands && tierBands.length > 0 ? [...tierBands] : [...DEFAULT_TIER_BANDS])
    .sort((a, b) => a.min - b.min);
  const [kind, setKind] = useState<TileKind>(() => deriveKind(initial));
  const [label, setLabel] = useState<string>(initial.label);
  const [description, setDescription] = useState<string>(initial.description || "");
  const [requiredAmount, setRequiredAmount] = useState<string>(initial.requiredAmount?.toString() || "");
  const [trackedStat, setTrackedStat] = useState<string>(initial.trackedStat || "");
  const [statGoal, setStatGoal] = useState<string>(initial.statGoal?.toString() || "");
  const [trackingMode, setTrackingMode] = useState<string>(initial.trackingMode || "team");
  const [optional, setOptional] = useState<boolean>(initial.optional || false);
  const [points, setPoints] = useState<string>(initial.points != null ? initial.points.toString() : "1");
  const [category, setCategory] = useState<string>(initial.category || "");
  // Comma-separated source NPC names (drop kinds only) — e.g. "Tekton". Empty = any source.
  const [sourceNpcsText, setSourceNpcsText] = useState<string>((initial.sourceNpcs || []).join(", "));
  // Kill-tile target NPC names — a multi-pick set (any listed name counts). Variants like
  // "The Nightmare" + "Phosani's Nightmare" can all be added so any of them count. The same
  // column carries diary selectors when the tile is the diary kind, so scope each state to
  // its own kind here.
  const [targetNpcNames, setTargetNpcNames] = useState<string[]>(
    initial.tileType === 'diary' ? [] : initial.targetNpcs || [],
  );
  // Diary selectors — "<Area> <Tier>" strings, "Any" wildcard on either side.
  const [diarySelectors, setDiarySelectors] = useState<string[]>(
    initial.tileType === 'diary' ? initial.targetNpcs || [] : [],
  );
  const [diaryArea, setDiaryArea] = useState<string>(DIARY_ANY);
  const [diaryTier, setDiaryTier] = useState<string>('Elite');
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
  // Loot-value threshold in gp (rides the requiredAmount column for the value kind).
  const [valueGpText, setValueGpText] = useState<string>(
    (initial.tileType === 'value' || initial.tileType === 'valuetotal') && initial.requiredAmount
      ? String(initial.requiredAmount)
      : '',
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
  // Concurrency stamp from the freshly-fetched tile; refreshed after each save so
  // consecutive saves in one sitting keep passing the PUT's baseUpdatedAt check.
  const [baseStamp, setBaseStamp] = useState<string | null>(initial.updatedAt ?? null);

  const isStat = kind === 'skill' || kind === 'boss';
  const isDrop = kind === 'drop' || kind === 'collection';
  const isCollection = kind === 'collection';
  const isKill = kind === 'kill';
  const isTimed = kind === 'timed';
  const isLms = kind === 'lms';
  const isValue = kind === 'value';
  const isDiary = kind === 'diary';

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
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'drop' || next === 'collection') {
      setTrackedStat("");
      setStatGoal("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'kill') {
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setDiarySelectors([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'diary') {
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
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
      setLmsPlacementCap('1');
    } else if (next === 'lms') {
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
      setDiarySelectors([]);
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
    if (kind === 'collection') {
      if (trackedItems.length === 0) return 'Add at least one item to the collection.';
      if (trackedItems.some((i) => i.perItemAmount < 1)) return 'Each collection item needs a count of at least 1.';
    }
    if (kind === 'kill') {
      if (targetNpcNames.length === 0) return 'Add at least one NPC to count kills for.';
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set a required kill count of at least 1.';
    }
    if (kind === 'diary') {
      if (diarySelectors.length === 0) return 'Add at least one diary (or "Any") to count completions for.';
      const amt = parseInt(requiredAmount, 10);
      if (!Number.isInteger(amt) || amt < 1) return 'Set a required completion count of at least 1.';
    }
    if (kind === 'timed') {
      if (!timedActivity.trim()) return 'Name the activity to time (e.g. Inferno).';
      const secs = clockToSeconds(timeThresholdClock);
      if (secs == null || secs < 1) return 'Set a time cap as mm:ss (e.g. 30:00) or seconds.';
      if (secs > 86400) return 'Time cap cannot exceed 24 hours.';
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
        label: label || undefined,
        description: description || null,
        optional,
        points: points ? Math.max(0, parseInt(points, 10) || 0) : 1,
        category: category.trim() || null,
        // defaults — overridden per kind below
        tileType: isDrop ? 'drop' : isKill ? 'kill' : isTimed ? 'timed' : isLms ? 'lms' : isValue ? (valueMode === 'total' ? 'valuetotal' : 'value') : isDiary ? 'diary' : 'standard',
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
      } else if (kind === 'diary') {
        // Diary selectors ride in the targetNpcs column — the diary tileType reinterprets it.
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.targetNpcs = diarySelectors;
        payload.trackingMode = trackingMode;
      } else if (kind === 'timed') {
        payload.timedActivity = timedActivity.trim();
        payload.timeThresholdSeconds = clockToSeconds(timeThresholdClock);
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
          trackedItemIds: updated.trackedItemIds ? JSON.parse(updated.trackedItemIds) : null,
          itemRequirements: updated.itemRequirements ? JSON.parse(updated.itemRequirements) : null,
          points: updated.points ?? 1,
          category: updated.category ?? null,
          sourceNpcs: updated.sourceNpcs ? JSON.parse(updated.sourceNpcs) : null,
          targetNpcs: updated.targetNpcs ? JSON.parse(updated.targetNpcs) : null,
          timedActivity: updated.timedActivity ?? null,
          timeThresholdSeconds: updated.timeThresholdSeconds ?? null,
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

  return (
    <div className="space-y-3">
      {/* Tile kind — the single source of truth for what this tile is */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Tile Kind</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => changeKind(k.key)}
              disabled={eventStarted}
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
          {eventStarted && ' · Kind is locked after the event starts.'}
        </p>
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Label</label>
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={eventStarted}
          className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
        />
        {eventStarted && <p className="text-[10px] text-text-muted mt-0.5">Cannot change after event start</p>}
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
        />
      </div>

      {/* ---- STAT KINDS (skill / boss) ---- */}
      {isStat && (
        <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">{kind === 'skill' ? 'Skill' : 'Boss'}</label>
            <Select
              value={trackedStat}
              onChange={setTrackedStat}
              placeholder={`Select ${kind === 'skill' ? 'a skill' : 'a boss'}...`}
              ariaLabel={kind === 'skill' ? 'Skill' : 'Boss'}
              options={
                kind === 'skill'
                  ? SKILLS.map((key) => ({ value: key, label: SKILL_LABELS[key] || key, keywords: SKILL_ALIASES[key] }))
                  : BOSSES.map((b) => ({ value: b.key, label: b.label, keywords: b.aliases }))
              }
            />
          </div>

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
                onClick={() => setTrackingMode("solo")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "solo" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
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
                disabled={eventStarted}
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
              {isCollection ? 'Collection Items' : 'Tracked Items'}
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
                        <Input
                          type="number"
                          value={item.perItemAmount}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setTrackedItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, perItemAmount: val } : i)));
                          }}
                          min="1"
                          className="w-14 px-1.5 py-0.5 bg-brown-dark border border-card-border rounded text-xs text-foreground text-center"
                          title="Required amount for this item"
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
              suggestions={SOURCE_SUGGESTIONS}
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
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Required Kills</label>
            <Input
              type="number"
              value={requiredAmount}
              onChange={(e) => setRequiredAmount(e.target.value)}
              disabled={eventStarted}
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
                onClick={() => setTrackingMode("solo")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "solo" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
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
              disabled={eventStarted}
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
                onClick={() => setTrackingMode("solo")}
                className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                  trackingMode === "solo" ? "bg-gold/20 border-gold text-gold" : "border-card-border text-text-muted hover:border-gold/50"
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
              suggestions={VALUE_SOURCE_SUGGESTIONS}
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
