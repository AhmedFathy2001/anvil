"use client";

import { useState, useEffect } from "react";

interface Skill {
  rank: number;
  level: number;
  xp: number;
}

interface Activity {
  rank: number;
  score: number;
}

interface Stats {
  skills: Record<string, Skill>;
  bosses: Record<string, Activity>;
  clues: Record<string, Activity>;
}

interface GainsData {
  [statKey: string]: number;
}

interface TileGoal {
  statKey: string;
  statType: string;
  goal: number | null;
  label: string;
}

interface Props {
  rsn: string;
  onClose: () => void;
  gains?: GainsData;
  tileGoals?: TileGoal[];
}

const SKILL_ORDER = [
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
  "runecraft",
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
  runecraft: "Runecraft",
  hunter: "Hunter",
  construction: "Construction",
  sailing: "Sailing",
};

function formatXp(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}m`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}k`;
  return xp.toString();
}

function formatRank(rank: number): string {
  if (rank < 0) return "-";
  if (rank >= 1_000_000) return `${(rank / 1_000_000).toFixed(1)}m`;
  if (rank >= 1_000) return `${(rank / 1_000).toFixed(1)}k`;
  return rank.toLocaleString();
}

function formatGain(value: number, type: "skill" | "boss"): string {
  if (type === "skill") return `+${formatXp(value)} xp`;
  return `+${value.toLocaleString()} kc`;
}

export default function PlayerStatsPanel({
  rsn,
  onClose,
  gains,
  tileGoals,
}: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/hiscores/${encodeURIComponent(rsn)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Player not found on hiscores");
        } else {
          setStats(data.stats);
        }
      } catch {
        setError("Failed to fetch hiscores");
      }
      setLoading(false);
    }
    fetchStats();
  }, [rsn]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-card-bg border border-card-border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card-bg border-b border-card-border p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gold">{rsn}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="text-center py-8 text-text-muted">
              Looking up hiscores...
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {stats && (
            <div className="space-y-4">
              {/* Tile Goals Progress */}
              {gains && tileGoals && tileGoals.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-text-muted mb-2">
                    Tile Progress
                  </h3>
                  <div className="space-y-2">
                    {tileGoals.map((tg) => {
                      const gain = gains[tg.statKey] ?? 0;
                      const pct = tg.goal
                        ? Math.min(100, Math.round((gain / tg.goal) * 100))
                        : null;
                      return (
                        <div
                          key={tg.statKey}
                          className="border border-card-border rounded-lg p-2 bg-brown-dark"
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold">{tg.label}</span>
                            <span className="text-accent-green-light font-mono">
                              {formatGain(
                                gain,
                                tg.statType as "skill" | "boss",
                              )}
                              {tg.goal && (
                                <span className="text-text-muted ml-1">
                                  /{" "}
                                  {tg.statType === "skill"
                                    ? formatXp(tg.goal)
                                    : tg.goal.toLocaleString()}
                                </span>
                              )}
                            </span>
                          </div>
                          {pct !== null && (
                            <div className="h-1.5 bg-card-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent-green rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Skills */}
              <div>
                <h3 className="text-sm font-bold text-text-muted mb-2">
                  Skills
                </h3>
                <div
                  className={`grid ${gains ? "grid-cols-[1fr_auto_auto_auto_auto]" : "grid-cols-[1fr_auto_auto_auto]"} gap-x-3 gap-y-0.5 text-sm`}
                >
                  <span className="text-text-muted text-xs">Skill</span>
                  <span className="text-text-muted text-xs text-right">
                    Level
                  </span>
                  <span className="text-text-muted text-xs text-right">XP</span>
                  {gains && (
                    <span className="text-text-muted text-xs text-right">
                      Gain
                    </span>
                  )}
                  <span className="text-text-muted text-xs text-right">
                    Rank
                  </span>
                  {SKILL_ORDER.map((key) => {
                    const skill = stats.skills[key];
                    if (!skill) return null;
                    const isTotal = key === "overall";
                    const gain = gains?.[key];
                    return (
                      <div key={key} className="contents">
                        <span className={isTotal ? "font-bold text-gold" : ""}>
                          {SKILL_LABELS[key] || key}
                        </span>
                        <span
                          className={`text-right font-mono ${isTotal ? "font-bold text-gold" : ""}`}
                        >
                          {skill.level}
                        </span>
                        <span className="text-right font-mono text-text-muted">
                          {formatXp(skill.xp)}
                        </span>
                        {gains && (
                          <span
                            className={`text-right font-mono text-xs ${gain && gain > 0 ? "text-accent-green-light" : "text-text-muted"}`}
                          >
                            {gain && gain > 0 ? `+${formatXp(gain)}` : "-"}
                          </span>
                        )}
                        <span className="text-right font-mono text-text-muted text-xs">
                          {formatRank(skill.rank)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notable bosses (only show those with kc > 0) */}
              {stats.bosses &&
                (() => {
                  const activeBosses = Object.entries(stats.bosses)
                    .filter(([, b]) => b.score > 0)
                    .sort(([, a], [, b]) => b.score - a.score);
                  if (activeBosses.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-bold text-text-muted mb-2">
                        Boss KC ({activeBosses.length})
                      </h3>
                      <div
                        className={`grid ${gains ? "grid-cols-[1fr_auto_auto_auto]" : "grid-cols-[1fr_auto_auto]"} gap-x-3 gap-y-0.5 text-sm`}
                      >
                        <span className="text-text-muted text-xs">Boss</span>
                        <span className="text-text-muted text-xs text-right">
                          KC
                        </span>
                        {gains && (
                          <span className="text-text-muted text-xs text-right">
                            Gain
                          </span>
                        )}
                        <span className="text-text-muted text-xs text-right">
                          Rank
                        </span>
                        {activeBosses.slice(0, 20).map(([key, boss]) => {
                          const gain = gains?.[key];
                          return (
                            <div key={key} className="contents">
                              <span className="truncate">
                                {formatBossName(key)}
                              </span>
                              <span className="text-right font-mono">
                                {boss.score.toLocaleString()}
                              </span>
                              {gains && (
                                <span
                                  className={`text-right font-mono text-xs ${gain && gain > 0 ? "text-accent-green-light" : "text-text-muted"}`}
                                >
                                  {gain && gain > 0
                                    ? `+${gain.toLocaleString()}`
                                    : "-"}
                                </span>
                              )}
                              <span className="text-right font-mono text-text-muted text-xs">
                                {formatRank(boss.rank)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBossName(key: string): string {
  const names: Record<string, string> = {
    abyssalSire: "Abyssal Sire",
    alchemicalHydra: "Alchemical Hydra",
    amoxliatl: "Amoxliatl",
    araxxor: "Araxxor",
    artio: "Artio",
    barrows: "Barrows",
    bryophyta: "Bryophyta",
    callisto: "Callisto",
    calvarion: "Calvar'ion",
    cerberus: "Cerberus",
    chambersOfXeric: "Chambers of Xeric",
    chambersOfXericChallengeMode: "CoX: CM",
    chaosElemental: "Chaos Elemental",
    chaosFanatic: "Chaos Fanatic",
    commanderZilyana: "Commander Zilyana",
    corporealBeast: "Corporeal Beast",
    crazyArchaeologist: "Crazy Archaeologist",
    dagannothPrime: "Dagannoth Prime",
    dagannothRex: "Dagannoth Rex",
    dagannothSupreme: "Dagannoth Supreme",
    derangedArchaeologist: "Deranged Archaeologist",
    dukeSucellus: "Duke Sucellus",
    generalGraardor: "General Graardor",
    giantMole: "Giant Mole",
    grotesqueGuardians: "Grotesque Guardians",
    hespori: "Hespori",
    kalphiteQueen: "Kalphite Queen",
    kingBlackDragon: "King Black Dragon",
    kraken: "Kraken",
    kreeArra: "Kree'Arra",
    krilTsutsaroth: "K'ril Tsutsaroth",
    lunarChests: "Lunar Chests",
    mimic: "Mimic",
    nex: "Nex",
    nightmare: "Nightmare",
    phosanisNightmare: "Phosani's Nightmare",
    obor: "Obor",
    phantomMuspah: "Phantom Muspah",
    sarachnis: "Sarachnis",
    scorpia: "Scorpia",
    scurrius: "Scurrius",
    skotizo: "Skotizo",
    solHeredit: "Sol Heredit",
    spindel: "Spindel",
    tempoross: "Tempoross",
    gauntlet: "The Gauntlet",
    corruptedGauntlet: "Corrupted Gauntlet",
    hueycoatl: "The Hueycoatl",
    leviathan: "The Leviathan",
    whisperer: "The Whisperer",
    theatreOfBlood: "Theatre of Blood",
    theatreOfBloodHardMode: "ToB: HM",
    thermonuclearSmokeDevil: "Thermy",
    tombsOfAmascut: "Tombs of Amascut",
    tombsOfAmascutExpertMode: "ToA: Expert",
    tzKalZuk: "TzKal-Zuk",
    tzTokJad: "TzTok-Jad",
    vardorvis: "Vardorvis",
    venenatis: "Venenatis",
    vetion: "Vet'ion",
    vorkath: "Vorkath",
    wintertodt: "Wintertodt",
    zalcano: "Zalcano",
    zulrah: "Zulrah",
    doomOfMokhaiotl: "Doom of Mokhaiotl",
    royalTitans: "The Royal Titans",
    yama: "Yama",
  };
  return (
    names[key] ||
    key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
  );
}
