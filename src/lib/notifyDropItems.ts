import { getItemMapping } from '@/lib/osrsItems';
import { rareTable } from '@/lib/notifyDrops';

/** Item names both ways, off the cached wiki mapping (lib/osrsItems), for lib/notifyDrops. */
export async function itemNameIndex() {
  const mapping = await getItemMapping().catch(() => []);
  if (mapping !== lastMapping) {
    const names = new Map<number, string>();
    const ids = new Map<string, number[]>();
    for (const m of mapping) {
      names.set(m.id, m.name);
      const k = m.name.toLowerCase();
      ids.set(k, [...(ids.get(k) ?? []), m.id]);
    }
    lastMapping = mapping;
    index = { nameOf: (id: number) => names.get(id), idsByName: ids };
    tables.clear();
  }
  return index;
}

let lastMapping: unknown = null;
let index: { nameOf: (id: number) => string | undefined; idsByName: Map<string, number[]> } = {
  nameOf: () => undefined,
  idsByName: new Map(),
};
const tables = new Map<number, Record<string, number[]>>();

/**
 * Floors snap DOWN to one of these before a table is built. The floor is the person's own number (any
 * integer, via /settings), so caching per exact floor would grow without bound; a looser gate is safe
 * because it only decides what gets screenshotted — /api/plugin/notify judges at the exact floor.
 */
const FLOOR_BUCKETS = [1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 250_000, 1_000_000];
export const floorBucket = (floor: number | null | undefined) =>
  !floor || floor <= 0 ? 0 : [...FLOOR_BUCKETS].reverse().find((b) => b <= floor) ?? FLOOR_BUCKETS[0];

/** The plugin's rarity screenshot gate at this floor (lib/notifyDrops rareTable), one table per bucket. */
export async function rareTableFor(floor: number | null | undefined): Promise<Record<string, number[]>> {
  const f = floorBucket(floor);
  const { nameOf, idsByName } = await itemNameIndex();
  let t = tables.get(f);
  if (!t) tables.set(f, (t = rareTable(f, idsByName, nameOf)));
  return t;
}
