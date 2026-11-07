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

/** The plugin's rarity screenshot gate at this floor (lib/notifyDrops rareTable), built once per floor. */
export async function rareTableFor(floor: number | null | undefined): Promise<Record<string, number[]>> {
  const f = floor && floor > 0 ? floor : 0;
  const { nameOf, idsByName } = await itemNameIndex();
  let t = tables.get(f);
  if (!t) tables.set(f, (t = rareTable(f, idsByName, nameOf)));
  return t;
}
