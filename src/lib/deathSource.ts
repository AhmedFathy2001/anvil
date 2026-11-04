import { BOSSES } from '@/lib/constants';
import { bossKeyForName } from '@/lib/pluginStats';

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
export function settleDeathSource(raw: Record<string, unknown>): void {
  if (raw.kind !== 'death' || raw.sourceKind !== FOUGHT_SOURCE_KIND) return;
  const boss = foughtBoss(raw.source);
  raw.source = boss;
  raw.sourceKind = boss ? 'npc' : null;
}
