"use client";

import { useState } from "react";
import { SKILLS, SKILL_LABELS, BOSSES } from "@/lib/constants";

interface TileConfig {
  label: string;
  description: string | null;
  tileType: string;
  requiredAmount: number | null;
  trackedStat: string | null;
  statType: string | null;
  statGoal: number | null;
  trackingMode: string;
  womCompetitionId: number | null;
  optional: boolean;
}

interface Props {
  tileId: number;
  eventId: number;
  initial: TileConfig;
  onSaved: (updated: TileConfig) => void;
  eventStarted?: boolean;
}

export default function TileTrackingConfig({
  tileId,
  eventId,
  initial,
  onSaved,
  eventStarted,
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
  const [womCompetitionId, setWomCompetitionId] = useState<string>(
    initial.womCompetitionId?.toString() || "",
  );
  const [optional, setOptional] = useState<boolean>(initial.optional || false);
  const [saving, setSaving] = useState(false);
  const [savingWom, setSavingWom] = useState(false);
  const [womError, setWomError] = useState<string | null>(null);
  const [womSuccess, setWomSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/tiles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tileId,
          label: label || undefined,
          description: description || null,
          tileType: tileType || "standard",
          requiredAmount: requiredAmount ? parseInt(requiredAmount, 10) : null,
          trackedStat: trackedStat || null,
          statType: statType || null,
          statGoal: statGoal ? parseInt(statGoal, 10) : null,
          trackingMode,
          optional,
        }),
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
          womCompetitionId: updated.womCompetitionId,
          optional: !!updated.optional,
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

  async function handleSaveWom() {
    setSavingWom(true);
    setWomError(null);
    setWomSuccess(false);
    try {
      const res = await fetch(`/api/events/${eventId}/tiles/${tileId}/wom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: womCompetitionId ? parseInt(womCompetitionId, 10) : null,
        }),
      });
      if (res.ok) {
        setWomSuccess(true);
        onSaved({
          ...initial,
          womCompetitionId: womCompetitionId ? parseInt(womCompetitionId, 10) : null,
        });
      } else {
        const data = await res.json();
        setWomError(data.error || "Failed to save");
      }
    } catch {
      setWomError("Failed to save");
    } finally {
      setSavingWom(false);
    }
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

      {/* Required amount (drop tiles only) */}
      {tileType === "drop" && (
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Required Amount
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

      {/* WOM Integration */}
      <div className="pt-3 mt-3 border-t border-card-border">
        <h4 className="text-sm font-semibold text-indigo-400 mb-2">Wise Old Man Tracking</h4>
        <p className="text-[10px] text-text-muted mb-2">
          Link a WOM competition to track XP gains for this tile. Get the ID from the competition URL.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={womCompetitionId}
            onChange={(e) => {
              setWomCompetitionId(e.target.value.replace(/\D/g, ""));
              setWomError(null);
              setWomSuccess(false);
            }}
            placeholder="Competition ID (e.g. 124043)"
            className="flex-1 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
          />
          <button
            type="button"
            onClick={handleSaveWom}
            disabled={savingWom}
            className="px-4 py-2 text-xs font-semibold rounded bg-indigo-500/20 border border-indigo-500 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-50 transition-colors"
          >
            {savingWom ? "..." : "Link"}
          </button>
        </div>
        {womError && <p className="text-xs text-red-400 mt-1">{womError}</p>}
        {womSuccess && <p className="text-xs text-green-400 mt-1">WOM competition linked!</p>}
        {initial.womCompetitionId && !womSuccess && (
          <p className="text-xs text-indigo-400 mt-1">
            Currently linked to WOM #{initial.womCompetitionId}
          </p>
        )}
      </div>
    </div>
  );
}
