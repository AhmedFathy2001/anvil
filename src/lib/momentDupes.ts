// A pet arrives twice: once as the pet (kind 'pet'), once as the item that dropped or the log slot it
// filled (a 'drop' / 'clog' moment for the same thing). Lists that show both kinds side by side keep
// the pet and leave the other out. Pure.

interface Dupable {
  kind: string;
  rsn: string;
  itemId?: number | null;
  itemName?: string | null;
  occurredAt: string;
}

/** How far apart the two sightings of one pet can land. */
const WINDOW_MS = 10 * 60_000;

const nameKey = (m: Dupable) => (m.itemName ?? '').trim().toLowerCase();

/** `moments` without the non-pet moment that doubles a pet by the same player. Order kept. */
export function withoutPetDoubles<T extends Dupable>(moments: T[]): T[] {
  const pets = moments.filter((m) => m.kind === 'pet');
  if (pets.length === 0) return moments;
  return moments.filter((m) => {
    if (m.kind === 'pet') return true;
    const at = Date.parse(m.occurredAt);
    return !pets.some(
      (p) =>
        p.rsn.toLowerCase() === m.rsn.toLowerCase() &&
        ((p.itemId != null && p.itemId === m.itemId) || (nameKey(p) !== '' && nameKey(p) === nameKey(m))) &&
        Math.abs(Date.parse(p.occurredAt) - at) <= WINDOW_MS,
    );
  });
}
