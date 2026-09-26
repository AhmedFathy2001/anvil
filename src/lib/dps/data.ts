// The gear datasets on the server (Discord summaries, the data API). Loaded once per process.
import itemsJson from '@/data/gearItems.json';
import monstersJson from '@/data/gearMonsters.json';
import { indexGear, type GearData, type GearIndex } from './summary';

export const GEAR_DATA: GearData = {
  items: (itemsJson as unknown as GearData).items,
  monsters: (monstersJson as unknown as GearData).monsters,
};

let index: GearIndex | null = null;
export function gearIndex(): GearIndex {
  return (index ??= indexGear(GEAR_DATA));
}
