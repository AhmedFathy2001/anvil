"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SKILLS, SKILL_LABELS, BOSSES } from "@/lib/constants";
import type { ItemRequirement, TileConfig } from '@/lib/types';

interface Props {
  tileId: number;
  eventId: number;
  initial: TileConfig;
  onSaved: (updated: TileConfig) => void;
  eventStarted?: boolean;
  pointsMode?: boolean;
}

export default function TileTrackingConfig({
  tileId,
  eventId,
  initial,
  onSaved,
  eventStarted,
  pointsMode,
}: Props) {
  const [label, setLabel] = useState<string>(initial.label);
  const [description, setDescription] = useState<string>(
    initial.description || "",
  );
  const [tileType, setTileType] = useState<string>(
    initial.tileType || "standard",
  );
  const [requiredAmount, setRequiredAmount] = useState<string>(
    initial.requiredAmount?.toString() || "",
  );
  const [statType, setStatType] = useState<string>(initial.statType || "");
  const [trackedStat, setTrackedStat] = useState<string>(
    initial.trackedStat || "",
  );
  const [statGoal, setStatGoal] = useState<string>(
    initial.statGoal?.toString() || "",
  );
  const [trackingMode, setTrackingMode] = useState<string>(
    initial.trackingMode || "team",
  );
  const [optional, setOptional] = useState<boolean>(initial.optional || false);
  const [points, setPoints] = useState<string>(
    initial.points != null ? initial.points.toString() : "1",
  );
  const [perItemMode, setPerItemMode] = useState<boolean>(!!initial.itemRequirements?.length);
  const [trackedItems, setTrackedItems] = useState<{ id: number; name: string; perItemAmount: number }[]>(
    initial.itemRequirements?.length
      ? initial.itemRequirements.map(r => ({ id: r.itemId, name: r.name, perItemAmount: r.requiredAmount }))
      : (initial.trackedItemIds || []).map(id => ({ id, name: `Item #${id}`, perItemAmount: 1 }))
  );
  const [itemSearch, setItemSearch] = useState("");
  const [itemResults, setItemResults] = useState<{ id: number; name: string }[]>([]);
  const [itemSearching, setItemSearching] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch item names for pre-existing IDs on mount
  useEffect(() => {
    if (initial.itemRequirements?.length) {
      // Per-item mode: names already available from requirements
      return;
    }
    if (!initial.trackedItemIds?.length) return;
    // Resolve names by searching each ID
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
      })
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
        // Filter out already-added items
        const existingIds = new Set(trackedItems.map(i => i.id));
        setItemResults(results.filter((r: { id: number }) => !existingIds.has(r.id)));
      }
    } catch { /* ignore */ }
    setItemSearching(false);
  }, [trackedItems]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        tileId,
        label: label || undefined,
        description: description || null,
        tileType: tileType || "standard",
        trackedStat: trackedStat || null,
        statType: statType || null,
        statGoal: statGoal ? parseInt(statGoal, 10) : null,
        trackingMode,
        optional,
        points: points ? Math.max(0, parseInt(points, 10) || 0) : 1,
      };

      if (perItemMode && trackedItems.length > 0) {
        // Per-item mode: send itemRequirements, server auto-derives trackedItemIds and requiredAmount
        payload.itemRequirements = trackedItems.map(i => ({
          itemId: i.id,
          name: i.name,
          requiredAmount: i.perItemAmount,
        }));
      } else {
        // Simple mode
        payload.itemRequirements = null;
        payload.requiredAmount = requiredAmount ? parseInt(requiredAmount, 10) : null;
        payload.trackedItemIds = trackedItems.length > 0 ? trackedItems.map(i => i.id) : null;
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
        });
      }
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setStatType("");
    setTrackedStat("");
    setStatGoal("");
    setTrackingMode("team");
  }

  function handleStatTypeChange(newType: string) {
    setStatType(newType);
    setTrackedStat("");
  }

  return (
    <div className="space-y-3">
      {/* Label edit */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={eventStarted}
          className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground disabled:opacity-50"
        />
        {eventStarted && (
          <p className="text-[10px] text-text-muted mt-0.5">
            Cannot change after event start
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-text-muted mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground resize-y"
          placeholder="Tile description..."
        />
      </div>

      {/* Point value (points-scoring events only) */}
      {pointsMode && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Point Value <span className="text-text-muted/60">(score awarded on completion)</span>
          </label>
          <input
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

      {/* Tile type toggle */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Tile Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTileType("standard")}
            disabled={eventStarted}
            className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50 ${
              tileType === "standard"
                ? "bg-gold/20 border-gold text-gold"
                : "border-card-border text-text-muted hover:border-gold/50"
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setTileType("drop")}
            disabled={eventStarted}
            className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50 ${
              tileType === "drop"
                ? "bg-accent-green/20 border-accent-green text-accent-green-light"
                : "border-card-border text-text-muted hover:border-gold/50"
            }`}
          >
            Drop
          </button>
        </div>
        {eventStarted && (
          <p className="text-[10px] text-text-muted mt-0.5">
            Cannot change after event start
          </p>
        )}
      </div>

      {/* Required amount (drop tiles only, hidden in per-item mode) */}
      {tileType === "drop" && !perItemMode && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Required Amount <span className="text-text-muted/60">(any tracked item counts)</span>
          </label>
          <input
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

      {/* Per-item mode: show auto-computed total */}
      {tileType === "drop" && perItemMode && trackedItems.length > 0 && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Total Required Amount <span className="text-text-muted/60">(auto-computed)</span>
          </label>
          <div className="px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground/60">
            {trackedItems.reduce((sum, i) => sum + i.perItemAmount, 0)}
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">
            Sum of each item&rsquo;s required amount below.
          </p>
        </div>
      )}

      {/* Tracked OSRS Item IDs (drop tiles only) — for RuneLite plugin */}
      {tileType === "drop" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-text-muted">
              Tracked Items
              <span className="text-text-muted/60 ml-1">(RuneLite plugin auto-detects these drops)</span>
            </label>
          </div>

          {/* Per-Item Tracking toggle */}
          {trackedItems.length > 0 && (
            <div className="mb-2 rounded border border-card-border bg-brown-dark/40 p-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPerItemMode(!perItemMode)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    perItemMode ? 'bg-accent-green' : 'bg-card-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      perItemMode ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-foreground/80">
                  Per-item tracking
                </span>
              </div>
              <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed">
                {perItemMode ? (
                  <>
                    <span className="text-accent-green-light">On:</span> each item needs its own count to complete the tile.
                    Use for sets like <span className="text-foreground/70">Moons</span> (1× Blood + 1× Blue + 1× Eclipse) or
                    <span className="text-foreground/70"> Justiciar</span> (1× helm + 1× chest + 1× legs).
                  </>
                ) : (
                  <>
                    <span className="text-text-muted/80">Off:</span> any tracked item drop counts toward one shared total.
                    Use for &ldquo;X drops from this boss pool&rdquo; tiles.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Added items */}
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
                  {perItemMode && (
                    <input
                      type="number"
                      value={item.perItemAmount}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setTrackedItems(prev => prev.map(i => i.id === item.id ? { ...i, perItemAmount: val } : i));
                      }}
                      min="1"
                      className="w-14 px-1.5 py-0.5 bg-brown-dark border border-card-border rounded text-xs text-foreground text-center"
                      title="Required amount for this item"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setTrackedItems(prev => prev.filter(i => i.id !== item.id))}
                    className="text-red-400 hover:text-red-300 flex-shrink-0"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search input */}
          <div ref={itemSearchRef} className="relative">
            <input
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
              placeholder="Search items (e.g. Dragon warhammer)..."
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
            />
            {itemSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                ...
              </span>
            )}

            {/* Dropdown results */}
            {showItemDropdown && itemResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-brown-dark border border-card-border rounded shadow-lg">
                {itemResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTrackedItems(prev => [...prev, { ...item, perItemAmount: 1 }]);
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
              Search and add the item drops this tile tracks. Once added, you can switch on per-item tracking if each item needs its own count.
            </p>
          )}
        </div>
      )}

      {/* Optional toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOptional(!optional)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            optional ? 'bg-gold' : 'bg-card-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              optional ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span className="text-xs text-text-muted">
          Optional tile (doesn&apos;t count towards total)
        </span>
      </div>

      <h4 className="text-sm font-semibold text-gold pt-2">Stat Tracking</h4>

      {/* Type selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleStatTypeChange("skill")}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            statType === "skill"
              ? "bg-gold/20 border-gold text-gold"
              : "border-card-border text-text-muted hover:border-gold/50"
          }`}
        >
          Skill
        </button>
        <button
          type="button"
          onClick={() => handleStatTypeChange("boss")}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            statType === "boss"
              ? "bg-gold/20 border-gold text-gold"
              : "border-card-border text-text-muted hover:border-gold/50"
          }`}
        >
          Boss
        </button>
        {(statType || trackedStat) && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stat dropdown */}
      {statType && (
        <select
          value={trackedStat}
          onChange={(e) => setTrackedStat(e.target.value)}
          className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
        >
          <option value="">
            Select {statType === "skill" ? "a skill" : "a boss"}...
          </option>
          {statType === "skill"
            ? SKILLS.map((key) => (
                <option key={key} value={key}>
                  {SKILL_LABELS[key] || key}
                </option>
              ))
            : BOSSES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
        </select>
      )}

      {/* Goal input */}
      {trackedStat && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Goal ({statType === "skill" ? "XP" : "KC"}) — optional
          </label>
          <input
            type="number"
            value={statGoal}
            onChange={(e) => setStatGoal(e.target.value)}
            placeholder={statType === "skill" ? "e.g. 1000000" : "e.g. 100"}
            className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
            min="0"
          />
        </div>
      )}

      {/* Tracking mode */}
      {trackedStat && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Tracking Mode
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTrackingMode("team")}
              className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                trackingMode === "team"
                  ? "bg-gold/20 border-gold text-gold"
                  : "border-card-border text-text-muted hover:border-gold/50"
              }`}
            >
              Team Total
            </button>
            <button
              type="button"
              onClick={() => setTrackingMode("solo")}
              className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                trackingMode === "solo"
                  ? "bg-gold/20 border-gold text-gold"
                  : "border-card-border text-text-muted hover:border-gold/50"
              }`}
            >
              Solo (Any Member)
            </button>
          </div>
        </div>
      )}

      {/* Save button */}
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
