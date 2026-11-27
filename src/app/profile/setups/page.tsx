import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { getItemMapping } from '@/lib/osrsItems';
import { contentFromKey, TRIP_CONTENT } from '@/lib/tripContent';
import { presetTags } from '@/lib/tripSetupNames';
import { setupsOfUser } from '@/lib/tripSetups';
import MySetupsClient, { type SetupCard } from './MySetupsClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My setups', robots: { index: false } };

/** "today", "yesterday", "3 days ago", "on 2026-10-02". */
function savedWhen(iso: string, now: number): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `on ${iso.slice(0, 10)}`;
}

/**
 * My setups: the pre-trip check's saved setups on each of the person's characters, by boss. Only the
 * owner sees it (the setups are read through setupsOfUser, which joins on the session's person); the
 * page renames, tags, picks defaults, shares and deletes (api/profile/setups/[id]). No bank shown.
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
  const raids = new Set(TRIP_CONTENT.filter((c) => c.instance).map((c) => c.key));
  const cards: SetupCard[] = setups.map((s) => {
    const c = contentFromKey(s.content);
    const inv = (s.setup.inventory ?? []).slice(0, 28);
    for (const id of [...Object.values(s.setup.gear), ...inv.map((x) => x?.id), ...(s.setup.runePouch ?? []).map((x) => x.id)]) {
      if (typeof id === 'number' && byId.has(id)) names[id] = byId.get(id)!;
    }
    return {
      id: s.id,
      accountId: s.accountId,
      content: s.content,
      contentName: c?.name ?? s.content,
      contentShort: c?.short ?? s.content,
      raid: raids.has(s.content),
      name: s.name || s.setup.name,
      tag: s.tag,
      presets: [...presetTags(s.content)],
      isDefault: s.isDefault,
      shareClan: s.shareClan,
      shareToken: s.shareToken,
      gear: s.setup.gear,
      inventory: inv,
      runePouch: s.setup.runePouch ?? [],
      spellbook: s.setup.spellbook ?? null,
      saved: savedWhen(s.updatedAt, now),
    };
  });
  const chars = characters
    .sort((a, b) => b.isPrimary - a.isPrimary || a.rsn.localeCompare(b.rsn))
    .map((a) => ({ id: a.id, rsn: a.rsn }));
  return (
    <div className="max-w-6xl mx-auto">
      <MySetupsClient setups={cards} characters={chars} names={names} />
    </div>
  );
}
