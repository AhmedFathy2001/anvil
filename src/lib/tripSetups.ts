// A player's own setups for the pre-trip check: "Save what you're wearing + inventory as my ToA
// setup". One per character and trip. OWNER-ONLY: written and read only for the account's own person
// (the plugin token's, on a character that is theirs), never shown to clan staff. Deleted with the
// person (lib/personData); turning item sharing off leaves them, since the player saved them on purpose.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { tripSetups } from '@/db/schema';
import { parseGearBlock, type GearSetup } from '@/lib/guideTiers';
import { ownsAccount } from '@/lib/playerItems';

/** A stored setup read back, through the gear block's own reader (tier and gear checked). */
function readSetup(v: unknown): GearSetup | null {
  return parseGearBlock(JSON.stringify({ monster: '', setups: [v] }))?.setups[0] ?? null;
}

const validKey = (content: string) => content.length > 0 && content.length <= 90;

export async function ownTripSetup(userId: number, accountId: number, content: string): Promise<GearSetup | null> {
  if (!validKey(content) || !(await ownsAccount(userId, accountId))) return null;
  // clan-scope: global -- a character's own setup, read for its own person.
  const [row] = await db
    .select({ setup: tripSetups.setup })
    .from(tripSetups)
    .where(and(eq(tripSetups.accountId, accountId), eq(tripSetups.content, content)))
    .limit(1);
  return row ? readSetup(row.setup) : null;
}

export async function saveOwnTripSetup(userId: number, accountId: number, content: string, setup: GearSetup): Promise<boolean> {
  if (!validKey(content) || !(await ownsAccount(userId, accountId))) return false;
  const at = new Date().toISOString();
  const value = setup as unknown as Record<string, unknown>;
  await db
    .insert(tripSetups)
    .values({ accountId, content, setup: value, createdAt: at, updatedAt: at })
    .onConflictDoUpdate({ target: [tripSetups.accountId, tripSetups.content], set: { setup: value, updatedAt: at } });
  return true;
}

export async function forgetOwnTripSetup(userId: number, accountId: number, content: string): Promise<void> {
  if (!validKey(content) || !(await ownsAccount(userId, accountId))) return;
  await db.delete(tripSetups).where(and(eq(tripSetups.accountId, accountId), eq(tripSetups.content, content)));
}
