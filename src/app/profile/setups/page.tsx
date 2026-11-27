import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { PROFILES } from '@/lib/loadout/profiles';
import { getItemMapping } from '@/lib/osrsItems';
import { contentFromKey } from '@/lib/tripContent';
import { setupsOfUser } from '@/lib/tripSetups';
import { cardOf } from './cards';
import MySetupsClient from './MySetupsClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My setups', robots: { index: false } };

/**
 * My setups: the pre-trip check's saved setups on each of the person's characters, as compact rows
 * by boss; a row opens the setup's own page (setups/[id]) with the full doll and its actions. Only
 * the owner sees it (setupsOfUser joins on the session's person). "Start from Anvil's loadout" builds
 * a new one from the character's bank (api/profile/setups). No bank shown.
 */
export default async function MySetupsPage() {
  const session = await verifyUser();
  if (!session) redirect(`/login?return=${encodeURIComponent('/profile/setups')}`);
  const [setups, characters, mapping] = await Promise.all([
    setupsOfUser(session.userId),
    session.playerId == null
      ? Promise.resolve([])
      : // clan-scope: global -- the person's own characters.
        db.select({ id: accounts.id, rsn: accounts.rsn, isPrimary: accounts.isPrimary }).from(accounts).where(eq(accounts.playerId, session.playerId)),
    getItemMapping().catch(() => []),
  ]);
  const byId = new Map(mapping.map((m) => [m.id, m.gameName ?? m.name]));
  const names: Record<number, string> = {};
  // Server component: Date.now() runs once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const cards = setups.map((s) => cardOf(s, byId, names, now));
  const chars = characters
    .sort((a, b) => b.isPrimary - a.isPrimary || a.rsn.localeCompare(b.rsn))
    .map((a) => ({ id: a.id, rsn: a.rsn }));
  const bosses = Object.keys(PROFILES).map((key) => ({ key, name: contentFromKey(key)?.name ?? PROFILES[key].name }));
  return (
    <div className="max-w-5xl mx-auto">
      <MySetupsClient setups={cards} characters={chars} names={names} bosses={bosses} />
    </div>
  );
}
