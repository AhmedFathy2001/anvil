"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SKILLS, SKILL_LABELS, SKILL_ALIASES, BOSSES } from "@/lib/constants";
import Select from '@/components/Select';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import type { TileConfig } from '@/lib/types';

interface Props {
  tileId: number;
  eventId: number;
  initial: TileConfig;
  onSaved: (updated: TileConfig) => void;
  eventStarted?: boolean;
  pointsMode?: boolean;
}

// A tile is exactly ONE kind. The kind decides which fields are meaningful — the form
// shows only those, and switching kind clears the others so the data model can never
// hold a nonsensical combo (e.g. a 10M-XP goal on a drop tile).
type TileKind = 'standard' | 'skill' | 'boss' | 'drop' | 'collection' | 'kill' | 'timed';

const KINDS: { key: TileKind; label: string; blurb: string }[] = [
  { key: 'standard', label: 'Standard', blurb: 'Manual tile — a captain marks it done. No auto-tracking.' },
  { key: 'skill', label: 'Skill XP', blurb: 'Auto-completes when a skill reaches an XP goal (hiscores-polled).' },
  { key: 'boss', label: 'Boss KC', blurb: 'Auto-completes when a boss reaches a kill-count goal (hiscores-polled).' },
  { key: 'drop', label: 'Item drop', blurb: 'N drops of an item (or any of a pool) — players submit evidence.' },
  { key: 'collection', label: 'Collection', blurb: 'A set where each listed item needs its own count (e.g. full Moons).' },
  { key: 'kill', label: 'Kill count', blurb: 'N kills of an NPC — even ones not on the hiscores (chickens, cows). Plugin-detected, baked screenshot.' },
  { key: 'timed', label: 'Timed clear', blurb: 'Clear an activity under a time cap (Inferno, raids, Colosseum). Plugin times it and bakes the result.' },
];

// Activity hints for timed tiles. The free-text field accepts any name the plugin can time.
const TIMED_ACTIVITY_SUGGESTIONS = [
  'Inferno',
  'Fight Caves',
  'Fortis Colosseum',
  'Chambers of Xeric',
  'Theatre of Blood',
  'Tombs of Amascut',
  'TzKal-Zuk',
  'Vorkath',
  'Zulrah',
  'Alchemical Hydra',
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

function deriveKind(initial: TileConfig): TileKind {
  if (initial.tileType === 'drop') {
    return initial.itemRequirements && initial.itemRequirements.length > 0 ? 'collection' : 'drop';
  }
  if (initial.tileType === 'kill') return 'kill';
  if (initial.tileType === 'timed') return 'timed';
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
}: Props) {
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
  // "The Nightmare" + "Phosani's Nightmare" can all be added so any of them count.
  const [targetNpcNames, setTargetNpcNames] = useState<string[]>(initial.targetNpcs || []);
  const [npcSearch, setNpcSearch] = useState("");
  const [npcResults, setNpcResults] = useState<string[]>([]);
  const [npcSearching, setNpcSearching] = useState(false);
  const [showNpcDropdown, setShowNpcDropdown] = useState(false);
  const npcSearchRef = useRef<HTMLDivElement>(null);
  const npcSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timed-tile activity + threshold.
  const [timedActivity, setTimedActivity] = useState<string>(initial.timedActivity || "");
  const [timeThresholdClock, setTimeThresholdClock] = useState<string>(secondsToClock(initial.timeThresholdSeconds));
  const [trackedItems, setTrackedItems] = useState<{ id: number; name: string; perItemAmount: number }[]>(
    initial.itemRequirements?.length
      ? initial.itemRequirements.map((r) => ({ id: r.itemId, name: r.name, perItemAmount: r.requiredAmount }))
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

  const isStat = kind === 'skill' || kind === 'boss';
  const isDrop = kind === 'drop' || kind === 'collection';
  const isCollection = kind === 'collection';
  const isKill = kind === 'kill';
  const isTimed = kind === 'timed';

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
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'drop' || next === 'collection') {
      setTrackedStat("");
      setStatGoal("");
      setTargetNpcNames([]);
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'kill') {
      setTrackedStat("");
      setStatGoal("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTimedActivity("");
      setTimeThresholdClock("");
    } else if (next === 'timed') {
      setTrackedStat("");
      setStatGoal("");
      setRequiredAmount("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
    } else {
      // standard
      setTrackedStat("");
      setStatGoal("");
      setRequiredAmount("");
      setTrackedItems([]);
      setSourceNpcsText("");
      setTargetNpcNames([]);
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
    if (kind === 'timed') {
      if (!timedActivity.trim()) return 'Name the activity to time (e.g. Inferno).';
      const secs = clockToSeconds(timeThresholdClock);
      if (secs == null || secs < 1) return 'Set a time cap as mm:ss (e.g. 30:00) or seconds.';
      if (secs > 86400) return 'Time cap cannot exceed 24 hours.';
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
        label: label || undefined,
        description: description || null,
        optional,
        points: points ? Math.max(0, parseInt(points, 10) || 0) : 1,
        category: category.trim() || null,
        // defaults — overridden per kind below
        tileType: isDrop ? 'drop' : isKill ? 'kill' : isTimed ? 'timed' : 'standard',
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
        }));
      } else if (kind === 'drop') {
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.trackedItemIds = trackedItems.length > 0 ? trackedItems.map((i) => i.id) : null;
      } else if (kind === 'kill') {
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.targetNpcs = targetNpcNames;
        payload.trackingMode = trackingMode;
      } else if (kind === 'timed') {
        payload.timedActivity = timedActivity.trim();
        payload.timeThresholdSeconds = clockToSeconds(timeThresholdClock);
      }

      if (isDrop) {
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
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save tile.');
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

      {/* Point value (points events only) */}
      {pointsMode && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Point Value <span className="text-text-muted/60">(score awarded on completion)</span>
          </label>
          <Input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            min="0"
            placeholder="e.g. 10"
            className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Higher = harder tile. A team&rsquo;s standing is the sum of points for the tiles it completes.
          </p>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-xs text-text-muted mb-1">
          Category <span className="text-text-muted/60">(groups tasks in the plugin, e.g. Zulrah, Slayer)</span>
        </label>
        <Input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. GWD"
          maxLength={60}
          className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
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
                {trackedItems.reduce((sum, i) => sum + i.perItemAmount, 0)}
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
            <Input
              type="text"
              list="source-npc-suggestions"
              value={sourceNpcsText}
              onChange={(e) => setSourceNpcsText(e.target.value)}
              placeholder="e.g. Zulrah  ·  Chambers of Xeric  ·  Barrows"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
            />
            <datalist id="source-npc-suggestions">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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

      {/* ---- TIMED KIND ---- */}
      {isTimed && (
        <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Activity</label>
            <Input
              type="text"
              list="timed-activity-suggestions"
              value={timedActivity}
              onChange={(e) => setTimedActivity(e.target.value)}
              placeholder="e.g. Inferno"
              maxLength={60}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
            />
            <datalist id="timed-activity-suggestions">
              {TIMED_ACTIVITY_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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
