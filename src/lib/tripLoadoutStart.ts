// "Start from Anvil's loadout" on My setups: the loadout engine (lib/tripLoadout) run server-side
// against the character's latest bank snapshot for one boss and plan, saved as a new setup of
// theirs (named by the trip's next preset tag, lib/tripSetups createTripSetup).
//
// OWNER-ONLY: the character must be the signed-in person's (ownsAccount), and the bank is read
// through snapshotForViewer, which checks the same. Nothing of the bank is returned: only the new
// setup's id and name.

import { effectiveGearIndex } from '@/lib/dps/store';
import { guideViewer } from '@/lib/guideViewer';
import { equivalentsFor } from '@/lib/itemFamilies';
import { getItemMapping } from '@/lib/osrsItems';
import { ownsAccount, tripStateForViewer } from '@/lib/playerItems';
import { contentFromKey } from '@/lib/tripContent';
import { cleanPlan, hasProfile, loadoutFor } from '@/lib/tripLoadout';
import { raidLevelFor } from '@/lib/tripRaidLevel';
import { createTripSetup } from '@/lib/tripSetups';

export type StartResult = { ok: true; id: number; name: string } | { ok: false; error: string };

export async function startFromAnvil(user: { userId: number; playerId: number }, accountId: number, contentKey: string, plan: unknown): Promise<StartResult> {
  const preset = cleanPlan(plan);
  const content = contentFromKey(contentKey);
  if (!preset || !content || !hasProfile(content.key)) return { ok: false, error: 'Pick a boss and a plan.' };
  if (!(await ownsAccount(user.userId, accountId))) return { ok: false, error: 'Not one of your characters.' };
  const viewer = await guideViewer(user, { items: true, accountId });
  const snap = viewer.accountId === accountId ? viewer.snapshot : null;
  if (!snap?.bank?.items.length) return { ok: false, error: 'Anvil hasn’t seen this character’s bank yet. Open your bank in game with the plugin on, then try again.' };
  const [idx, state, mapping, raidLevel] = await Promise.all([
    effectiveGearIndex(),
    tripStateForViewer(user.userId, accountId),
    getItemMapping().catch(() => []),
    content.key === 'toa' ? raidLevelFor(accountId) : Promise.resolve(null),
  ]);
  const byId = new Map(mapping.map((m) => [m.id, m.gameName ?? m.name]));
  const byName = new Map([...mapping].reverse().map((m) => [(m.gameName ?? m.name).toLowerCase(), m.id]));
  const pouches = new Set(mapping.filter((m) => /^(divine )?rune pouch\b/i.test(m.gameName ?? m.name)).map((m) => m.id));
  const worn = snap.equipment?.items ?? [];
  const inventory = snap.inventory?.items ?? [];
  const bank = snap.bank.items;
  const lootingBag = snap.lootingBag?.items;
  const holds = equivalentsFor([...worn, ...inventory, ...bank, ...(lootingBag ?? [])].map((i) => i.id), 'holds');
  const got = loadoutFor({
    contentKey: content.key,
    preset,
    idx,
    worn,
    inventory,
    bank,
    lootingBag,
    state,
    levels: viewer.levels,
    raidLevel,
    nameOf: (id) => byId.get(id) ?? idx.item(id)?.n ?? `Item ${id}`,
    holds,
    isRunePouch: (id) => pouches.has(id),
    idOfName: (n) => byName.get(n.toLowerCase()) ?? null,
  });
  if (!got || !Object.keys(got.setup.gear).length) return { ok: false, error: `Nothing in your bank can fight ${content.name} yet.` };
  const made = await createTripSetup(user.userId, accountId, content.key, content.short, got.setup);
  if (!made) return { ok: false, error: `This character has the most ${content.short} setups one trip keeps. Delete one first.` };
  return { ok: true, id: made.id, name: made.name };
}
