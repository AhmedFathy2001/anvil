import type { Metadata } from 'next';

import WritersPage from '@/components/guides/WritersPage';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hasPlatformRole } from '@/lib/clanRoles';
import { canCurateUser, featuredFor, listWanted, monthOf, myPieces, ranksFor } from '@/lib/guideCommunity';
import { impactBand, nextRank } from '@/lib/guideCredit';
import { supporterForUsers } from '@/lib/supporter';

export const metadata: Metadata = { title: 'Writers · Guides' };

export default async function GuideWritersPage() {
  const user = await verifyUser();
  const month = monthOf(new Date().toISOString());
  const [featured, wanted] = await Promise.all([featuredFor(month), listWanted({ limit: 6 })]);
  const ids = [...featured.map((f) => f.userId), ...(user ? [user.userId] : [])];
  const [ranks, supporters] = await Promise.all([ranksFor(ids, month), supporterForUsers(ids).catch(() => new Map())]);
  const row = user ? await db.query.users.findFirst({ where: eq(users.id, user.userId), columns: { platformRole: true } }) : null;
  const mine = user ? ranks.get(user.userId) : null;
  const tone = (r: { quill: string } | null | undefined) => (r ? (r.quill as 'bronze' | 'silver' | 'gold') : null);
  return (
    <WritersPage
      month={month}
      me={
        user && mine
          ? {
              rank: mine.rank?.label ?? null,
              tone: tone(mine.rank),
              band: impactBand(mine.lifetime),
              monthBand: impactBand(mine.month),
              toGo: (() => {
                const n = nextRank(mine.lifetime);
                return n ? { rank: n.rank.label, n: n.toGo } : null;
              })(),
              supporter: supporters.has(user.userId),
              pieces: await myPieces(user.userId),
            }
          : null
      }
      featured={featured.map((f) => ({ ...f, tone: tone(ranks.get(f.userId)?.rank), supporter: supporters.has(f.userId) }))}
      canCurate={user ? await canCurateUser(user.userId) : false}
      isStaff={!!row && hasPlatformRole(row.platformRole, 'staff')}
      wanted={wanted.map((w) => ({ guideTitle: w.guideTitle, topic: w.topic, requesters: w.requesters, slug: w.guideSlug }))}
    />
  );
}
