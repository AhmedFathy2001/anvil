// The automatic "used it": a boss kill the plugin pushed (lib/accountPush), worn in one of that
// boss's guide setups, votes for the setup with source 'auto' (lib/guideCommunity voteUsed).
//
// ANTI-GAMING. Only a character the plugin proved (accounts.verificationMethod 'plugin') counts, and
// only off worn gear the plugin itself pushed (POST /api/plugin/items stores it only for the token
// owner's own character). At most once a day per person per setup.

import { and, asc, eq, gt } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, guideSetupVotes, playerItemSnapshots, users } from '@/db/schema';
import { voteUsed } from '@/lib/guideCommunity';
import { matchWornSetup, type WornSetup } from '@/lib/guideSetupMatch';
import { setupKey } from '@/lib/guideSetups';
import { firstGearBlock } from '@/lib/guideTiers';
import { equivalentsFor, kcKeyOf } from '@/lib/guideViewer';
import { listLibrary } from '@/lib/guides';
import { ttlMemo } from '@/lib/ttlMemo';

const DAY_MS = 24 * 60 * 60_000;

/** Library guides with a gear block, by the boss their kc is on. Kept five minutes. */
function guidesByBoss(): Promise<Map<string, { id: number; setups: WornSetup[] }[]>> {
  return ttlMemo(
    'guides:auto-used:by-boss',
    async () => {
      const out = new Map<string, { id: number; setups: WornSetup[] }[]>();
      for (const g of await listLibrary()) {
        if (g.kind === 'route') continue;
        const block = firstGearBlock(g.body);
        const boss = kcKeyOf(block);
        if (!block || !boss) continue;
        const setups = block.setups.map((s, i) => ({ key: setupKey(s, i), gear: s.gear, alts: s.alts }));
        out.set(boss, [...(out.get(boss) ?? []), { id: g.id, setups }]);
      }
      return out;
    },
    5 * 60_000,
  );
}

/** Votes the setups this kill was worn in; returns how many it cast. Never throws past a bad row. */
export async function autoUsedFromKills(accountId: number, bossKeys: string[]): Promise<number> {
  const byBoss = await guidesByBoss();
  const hit = [...new Set(bossKeys)].flatMap((k) => byBoss.get(k) ?? []);
  if (!hit.length) return 0;
  // clan-scope: global -- the account is the pushing character's own; votes are the person's.
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId), columns: { playerId: true, verifiedAt: true, verificationMethod: true } });
  if (!account?.playerId || !account.verifiedAt || account.verificationMethod !== 'plugin') return 0;
  const [user, equipment] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.playerId, account.playerId), columns: { id: true }, orderBy: asc(users.id) }),
    db.query.playerItemSnapshots.findFirst({ where: and(eq(playerItemSnapshots.accountId, accountId), eq(playerItemSnapshots.container, 'equipment')), columns: { items: true } }),
  ]);
  const worn = (equipment?.items ?? []).map((i) => i.id);
  if (!user || !worn.length) return 0;
  const same = equivalentsFor(worn);
  const since = new Date(Date.now() - DAY_MS).toISOString();
  let cast = 0;
  for (const g of hit) {
    const key = matchWornSetup(worn, g.setups, same);
    if (!key) continue;
    const recent = await db.query.guideSetupVotes.findFirst({
      where: and(eq(guideSetupVotes.guideId, g.id), eq(guideSetupVotes.setupKey, key), eq(guideSetupVotes.userId, user.id), gt(guideSetupVotes.lastUsedAt, since)),
      columns: { id: true },
    });
    if (recent) continue;
    if ((await voteUsed({ guideId: g.id, setupKey: key, userId: user.id, source: 'auto' })).ok) cast++;
  }
  return cast;
}
