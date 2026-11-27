import { BOSSES } from '@/lib/constants';
import { bossKeyForName } from '@/lib/pluginStats';
import { isRaidFamily, raidOfNpc } from '@/lib/raidNpcs';

// What a death report may name as its killer.
//
// The plugin names a killer from what had the player TARGETED when they last took damage
// (DeathAttribution). Some bosses never show as targeting you (Alchemical Hydra), and a mechanic
// (an acid pool) has nobody behind it, so that list can be empty at a boss that plainly killed
// you. Then the plugin sends what the player was FIGHTING instead, marked `sourceKind: 'fought'`.
//
// That is a guess, and the old feed showed why it can't be taken as is: "died to Jug", "died to
// Abyssal portal". So a fought name is kept only when it is a boss we know, and shown under the
// boss's own name. Anything else is dropped and the death reads plainly ("Died").
//
// Pure (no db): the moments route and the lab feed read it.

/** The plugin's mark on a killer it inferred from the fight rather than from who targeted us. */
export const FOUGHT_SOURCE_KIND = 'fought';

const LABEL = new Map(BOSSES.map((b) => [b.key, b.label]));

/** A fought name → the boss's label, or null when it isn't a boss. */
export function foughtBoss(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return null;
  const key = bossKeyForName(name.trim());
  return key ? LABEL.get(key) ?? null : null;
}

/**
 * Settle a raw death report in place: a `fought` killer becomes the boss (sourceKind 'npc') or
 * nothing. Every other report is left exactly as it came.
 */
/**
 * NPCs the plugin can see "targeting" you around a death that never killed anyone: Death himself,
 * who talks to you in Death's Domain right after you die ("Died to Death" at Phosani's Nightmare).
 * Lower-case names; a death naming one of these reads plainly ("Died").
 */
const NOT_A_KILLER = new Set([
  'death',
  // Kephri's scarabs despawn while still targeting you, and plugins before 1.16.1 kept the name:
  // every later death in the raid (Zebak, Akkha…) read "Killed by Agile Scarab". Plain "Died" instead.
  'agile scarab', 'arcane scarab', 'spitting scarab', 'soldier scarab', 'scarab swarm',
]);

/**
 * A follower's NPC name: pets target their owner to follow them, and a plugin that doesn't know the
 * pet is the player's own follower (another player's pet, older plugins) names it ("Died to Lil'
 * Xarp"). No monster that can kill you is called Lil' …; the rest are the odd-named pets.
 */
// "Lil'" needs its apostrophe: no RSN can hold one, so a PvP killer called "Lil Bob" is never hidden.
const PET_NAME = /^(?:lil'|little (?:nightmare|parasite)$|tiny tempor$|smol heredit$|(?:corrupted )?youngllef$)/i;

const neverKiller = (name: string) => NOT_A_KILLER.has(name.trim().toLowerCase()) || PET_NAME.test(name.trim());

/** A stored death's killer as it should read: null for one of the never-killers above, or a pet. */
export function shownKiller(source: string | null | undefined): string | null {
  return source && !neverKiller(source) ? source : null;
}

export function settleDeathSource(raw: Record<string, unknown>): void {
  if (raw.kind !== 'death') return;
  // Which raid it was: a Boss Rush over a raid counts the raid's deaths, whatever killed them. A
  // current plugin says so itself, from the game's own "in this raid" values, which also covers the
  // deaths nothing is behind (Warden skulls, Zebak's waves, Olm's crystals). An older one only names
  // a killer, so it is read off the name before anything below blanks it (lib/raidNpcs).
  // "toa-entry"/"tob-entry": the Entry Modes, their own targets (lib/bossRushRules RUSH_RAID_TARGETS).
  // A client that says where it stood (regionId) also checked the raid state there: no tag from it
  // means no raid, so its killer's name is never a reason to guess one (a Lizardman shaman under the
  // Farming Guild is not Chambers of Xeric).
  const placed = typeof raw.regionId === 'number';
  const raid = raw.raid === 'toa-entry' || raw.raid === 'tob-entry' || isRaidFamily(raw.raid) ? raw.raid : placed || raw.sourceKind === 'player' ? null : raidOfNpc(raw.source);
  if (raid) raw.raid = raid;
  else delete raw.raid;
  if (typeof raw.source === 'string' && raw.sourceKind !== 'player' && neverKiller(raw.source)) {
    raw.source = null;
    raw.sourceKind = null;
    return;
  }
  if (raw.sourceKind !== FOUGHT_SOURCE_KIND) return;
  const boss = foughtBoss(raw.source);
  raw.source = boss;
  raw.sourceKind = boss ? 'npc' : null;
}
