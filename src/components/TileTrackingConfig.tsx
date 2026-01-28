"use client";

import { useState } from "react";

interface TileConfig {
  label: string;
  description: string | null;
  tileType: string;
  requiredAmount: number | null;
  trackedStat: string | null;
  statType: string | null;
  statGoal: number | null;
  trackingMode: string;
}

interface Props {
  tileId: number;
  eventId: number;
  initial: TileConfig;
  onSaved: (updated: TileConfig) => void;
  eventStarted?: boolean;
}

const SKILLS = [
  "overall",
  "attack",
  "defence",
  "strength",
  "hitpoints",
  "ranged",
  "prayer",
  "magic",
  "cooking",
  "woodcutting",
  "fletching",
  "fishing",
  "firemaking",
  "crafting",
  "smithing",
  "mining",
  "herblore",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "runecrafting",
  "hunter",
  "construction",
  "sailing",
];

const SKILL_LABELS: Record<string, string> = {
  overall: "Total",
  attack: "Attack",
  defence: "Defence",
  strength: "Strength",
  hitpoints: "Hitpoints",
  ranged: "Ranged",
  prayer: "Prayer",
  magic: "Magic",
  cooking: "Cooking",
  woodcutting: "Woodcutting",
  fletching: "Fletching",
  fishing: "Fishing",
  firemaking: "Firemaking",
  crafting: "Crafting",
  smithing: "Smithing",
  mining: "Mining",
  herblore: "Herblore",
  agility: "Agility",
  thieving: "Thieving",
  slayer: "Slayer",
  farming: "Farming",
  runecrafting: "Runecrafting",
  hunter: "Hunter",
  construction: "Construction",
  sailing: "Sailing",
};

const BOSSES: { key: string; label: string }[] = [
  { key: "abyssalSire", label: "Abyssal Sire" },
  { key: "alchemicalHydra", label: "Alchemical Hydra" },
  { key: "amoxliatl", label: "Amoxliatl" },
  { key: "araxxor", label: "Araxxor" },
  { key: "artio", label: "Artio" },
  { key: "barrows", label: "Barrows" },
  { key: "bryophyta", label: "Bryophyta" },
  { key: "callisto", label: "Callisto" },
  { key: "calvarion", label: "Calvar'ion" },
  { key: "cerberus", label: "Cerberus" },
  { key: "chambersOfXeric", label: "Chambers of Xeric" },
  { key: "chambersOfXericChallengeMode", label: "CoX: CM" },
  { key: "chaosElemental", label: "Chaos Elemental" },
  { key: "chaosFanatic", label: "Chaos Fanatic" },
  { key: "commanderZilyana", label: "Commander Zilyana" },
  { key: "corporealBeast", label: "Corporeal Beast" },
  { key: "crazyArchaeologist", label: "Crazy Archaeologist" },
  { key: "dagannothPrime", label: "Dagannoth Prime" },
  { key: "dagannothRex", label: "Dagannoth Rex" },
  { key: "dagannothSupreme", label: "Dagannoth Supreme" },
  { key: "derangedArchaeologist", label: "Deranged Archaeologist" },
  { key: "dukeSucellus", label: "Duke Sucellus" },
  { key: "generalGraardor", label: "General Graardor" },
  { key: "giantMole", label: "Giant Mole" },
  { key: "grotesqueGuardians", label: "Grotesque Guardians" },
  { key: "hespori", label: "Hespori" },
  { key: "kalphiteQueen", label: "Kalphite Queen" },
  { key: "kingBlackDragon", label: "King Black Dragon" },
  { key: "kraken", label: "Kraken" },
  { key: "kreeArra", label: "Kree'Arra" },
  { key: "krilTsutsaroth", label: "K'ril Tsutsaroth" },
  { key: "lunarChests", label: "Lunar Chests" },
  { key: "mimic", label: "Mimic" },
  { key: "nex", label: "Nex" },
  { key: "nightmare", label: "Nightmare" },
  { key: "phosanisNightmare", label: "Phosani's Nightmare" },
  { key: "obor", label: "Obor" },
  { key: "phantomMuspah", label: "Phantom Muspah" },
  { key: "sarachnis", label: "Sarachnis" },
  { key: "scorpia", label: "Scorpia" },
  { key: "scurrius", label: "Scurrius" },
  { key: "skotizo", label: "Skotizo" },
  { key: "solHeredit", label: "Sol Heredit" },
  { key: "spindel", label: "Spindel" },
  { key: "tempoross", label: "Tempoross" },
  { key: "gauntlet", label: "The Gauntlet" },
  { key: "corruptedGauntlet", label: "Corrupted Gauntlet" },
  { key: "hueycoatl", label: "The Hueycoatl" },
  { key: "leviathan", label: "The Leviathan" },
  { key: "whisperer", label: "The Whisperer" },
  { key: "theatreOfBlood", label: "Theatre of Blood" },
  { key: "theatreOfBloodHardMode", label: "ToB: HM" },
  { key: "thermonuclearSmokeDevil", label: "Thermy" },
  { key: "tombsOfAmascut", label: "Tombs of Amascut" },
  { key: "tombsOfAmascutExpertMode", label: "ToA: Expert" },
  { key: "tzKalZuk", label: "TzKal-Zuk" },
  { key: "tzTokJad", label: "TzTok-Jad" },
  { key: "vardorvis", label: "Vardorvis" },
  { key: "venenatis", label: "Venenatis" },
  { key: "vetion", label: "Vet'ion" },
  { key: "vorkath", label: "Vorkath" },
  { key: "wintertodt", label: "Wintertodt" },
  { key: "zalcano", label: "Zalcano" },
  { key: "zulrah", label: "Zulrah" },
  { key: "doomOfMokhaiotl", label: "Doom of Mokhaiotl" },
  { key: "royalTitans", label: "The Royal Titans" },
  { key: "yama", label: "Yama" },
];

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
  const [saving, setSaving] = useState(false);

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
