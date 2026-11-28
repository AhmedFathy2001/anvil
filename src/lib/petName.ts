import { petsBySource } from '@/lib/dropFacts';
import { isGenericPetName } from '@/lib/genericPetName';

// A pet the plugin could not name.
//
// The game's duplicate line ("You have a funny feeling like you would have been followed...") names
// no pet, and when the clan broadcast that does name it is missed (or lands outside the plugin's
// naming window) the pet reaches us with no item name, and often no source either: the line comes at
// the kill, before the loot event the plugin reads a source from. The feed then fell back to the
// row's kind and read "Pet: pet".
//
// The kill's loot normally rides in the same push (the plugin coalesces a few seconds), and its
// source names the boss, which names the pet. Pure: the ingest route and the readers both use it.

export { isGenericPetName } from '@/lib/genericPetName';

/** The one pet a source drops, or null when it drops none or several (nothing honest to pick). */
export function petForSource(source: string | null | undefined): { id: number; name: string } | null {
  const key = (source ?? '').split('#')[0].trim().toLowerCase();
  if (!key) return null;
  const pets = petsBySource().get(key);
  return pets && pets.length === 1 ? pets[0] : null;
}

/**
 * What a pet row reads as when it has no name: "Pet from Skotizo", else "Pet". The display side of
 * the same gap, so no surface ever prints the row's kind as if it were the pet.
 */
export function petLabel(m: { itemName?: string | null; source?: string | null }): string {
  const name = m.itemName?.trim();
  if (name && !isGenericPetName(name)) return name;
  const source = m.source?.trim();
  return source ? `Pet from ${source}` : 'Pet';
}

/** The label any feed puts on a moment: a pet by {@link petLabel}, the rest by name, else source, else kind. */
export function momentLabel(m: { kind: string; itemName?: string | null; source?: string | null }): string {
  if (m.kind === 'pet') return petLabel(m);
  return m.itemName ?? m.source ?? m.kind;
}

/** One report in a push, as far as naming a pet goes. */
export interface PetSighting {
  kind: string;
  itemName?: string | null;
  source?: string | null;
  sourceKind?: string | null;
  kc?: number | null;
  /** Epoch ms. */
  at: number;
}

export interface PetFill {
  itemName: string;
  itemId: number;
  source: string;
  sourceKind: string | null;
  kc: number | null;
}

/** How far a kill's loot may land from its pet line and still be that kill: the loot follows by seconds. */
export const PET_LOOT_AFTER_MS = 30_000;
/** A loot event a little before the line (same kill, clocks a tick apart). Kept short: an earlier kill is another kill. */
export const PET_LOOT_BEFORE_MS = 10_000;

/**
 * The name for an unnamed pet out of the reports around it: its own source when it has one, else the
 * nearest drop from a boss with exactly one pet inside the window (after the line first, since the
 * loot follows the kill). Null when nothing places it.
 */
export function fillForPet(pet: PetSighting, around: readonly PetSighting[]): PetFill | null {
  if (pet.kind !== 'pet' || !isGenericPetName(pet.itemName)) return null;
  const own = petForSource(pet.source);
  if (own) return { itemName: own.name, itemId: own.id, source: pet.source!.trim(), sourceKind: pet.sourceKind ?? null, kc: pet.kc ?? null };
  // No source, or one that drops no single pet (a minion, a chest): the kill's loot decides.
  let best: { s: PetSighting; pet: { id: number; name: string }; score: number } | null = null;
  for (const s of around) {
    if (s === pet || s.kind !== 'drop') continue;
    const d = s.at - pet.at;
    if (d > PET_LOOT_AFTER_MS || d < -PET_LOOT_BEFORE_MS) continue;
    const found = petForSource(s.source);
    if (!found) continue;
    // Loot after the line beats loot before it at the same distance.
    const score = d >= 0 ? d : -d + PET_LOOT_AFTER_MS;
    if (!best || score < best.score) best = { s, pet: found, score };
  }
  if (!best) return null;
  return {
    itemName: best.pet.name,
    itemId: best.pet.id,
    source: best.s.source!.trim(),
    sourceKind: best.s.sourceKind ?? null,
    kc: pet.kc ?? best.s.kc ?? null,
  };
}

/** {@link fillForPet} for every unnamed pet in a push, by index. */
export function unnamedPetFills(rows: readonly PetSighting[]): Map<number, PetFill> {
  const out = new Map<number, PetFill>();
  rows.forEach((r, i) => {
    const fill = fillForPet(r, rows);
    if (fill) out.set(i, fill);
  });
  return out;
}

/** A pet's line in a list that suffixes ", pet" to a named one: an unnamed pet's label already says so. */
export function petLine(label: string): string {
  return label === 'Pet' || label.startsWith('Pet from ') ? label : `${label}, pet`;
}

/**
 * A pet posted with no name (the duplicate line names none) but a source that drops exactly one pet
 * is that pet: Skotizo can only have been Skotos. Unchanged facts otherwise. For /api/plugin/notify.
 */
export function withPetName(facts: unknown): unknown {
  if (!facts || typeof facts !== 'object') return facts;
  const o = facts as Record<string, unknown>;
  if (!isGenericPetName(typeof o.name === 'string' ? o.name : null)) return facts;
  const pet = petForSource(typeof o.source === 'string' ? o.source : null);
  return pet ? { ...o, name: pet.name, itemId: pet.id } : facts;
}
