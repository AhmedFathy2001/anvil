import { redirect } from 'next/navigation';

import { clanHref } from '@/lib/clanPath';
import { requireClan } from '@/lib/clanContext';
import { verifyFeeCollector } from '@/lib/auth';
import { getCofferBalance, listCofferEntries } from '@/lib/coffer';
import { db } from '@/db';
import { clanRoster } from '@/db/schema';
import { and, eq, isNull, asc } from 'drizzle-orm';
import CofferClient from './CofferClient';

export const dynamic = 'force-dynamic';

/**
 * The clan's pot: what is in it, what it has already promised, and the two decisions only a person
 * can make — is this donation real, and has this prize actually been sent.
 *
 * Behind the fee-collector grant rather than plain moderator, for the reason /admin/fees is: this is
 * the clan's money, and rank has never conferred the right to move it.
 */
export default async function AdminCofferPage() {
  const session = await verifyFeeCollector();
  if (!session) redirect(await clanHref('/admin'));
  const clan = await requireClan();

  const [balance, entries, roster] = await Promise.all([
    getCofferBalance(clan.id),
    listCofferEntries({ clanId: clan.id, limit: 200 }),
    // Who a donation can be credited to. Guests included: somebody who is not on the roster proper
    // can still have paid into the pot, and refusing to name them is not a policy anyone asked for.
    db
      .select({ id: clanRoster.id, rsn: clanRoster.rsn, kind: clanRoster.kind })
      .from(clanRoster)
      .where(and(eq(clanRoster.clanId, clan.id), isNull(clanRoster.leftAt)))
      .orderBy(asc(clanRoster.rsn)),
  ]);

  return <CofferClient balance={balance} entries={entries} roster={roster} />;
}
