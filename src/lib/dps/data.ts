// The BUNDLED gear datasets (src/data/gear*.json, from `npm run data:gear`). The live data — a /staff
// refresh plus platform overrides — is lib/dps/store, which falls back to this.
import itemsJson from '@/data/gearItems.json';
import monstersJson from '@/data/gearMonsters.json';
import type { GearData } from './summary';

export const GEAR_DATA: GearData = {
  items: (itemsJson as unknown as GearData).items,
  monsters: (monstersJson as unknown as GearData).monsters,
};
