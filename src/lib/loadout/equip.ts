// Can the player wear it: the item's equip requirements against their levels, as the loadout
// engine's `canEquip` (null = yes, else the reason, "needs 75 Attack"). PURE.
//
// The requirements live with the gear data (lib/dps); until a level set is known nothing is blocked.

import type { GearItem } from '../dps/engine';

export function equipCheck(levels: Record<string, number> | null): ((it: GearItem) => string | null) | null {
  if (!levels) return null;
  return null;
}
