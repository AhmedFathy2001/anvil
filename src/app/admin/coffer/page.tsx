import { redirect } from 'next/navigation';
import { requireFeature } from '@/lib/clanFeatures';

import { clanHref } from '@/lib/clanPath';
import { requireClan } from '@/lib/clanContext';
import { verifyFeeCollector } from '@/lib/auth';
import { getCofferBalance, getCofferMoneyOut, listCofferEntries } from '@/lib/coffer';
import { getPhysicalCofferState } from '@/lib/cofferSync';
import { db } from '@/db';
import { clanRoster } from '@/db/schema';
import { rosterClanSeat } from '@/lib/seatScope';
import { and, eq, isNull, asc } from 'drizzle-orm';
import CofferClient from './CofferClient';
import { creatorAway } from '@/lib/creatorGuard';
import { getSetting } from '@/lib/settings';
import { HCW_COFFER_SETTING_KEY, type PrizeCurrency } from '@/lib/competitionGame';

export const dynamic = 'force-dynamic';

/**
 * The clan's pot: what is in it, what it has already promised, and the two decisions only a person
 * can make — is this donation real, and has this prize actually been sent.
 *
 * Behind the fee-collector grant rather than plain moderator, for the reason /admin/fees is: this is
 * the clan's money, and rank has never conferred the right to move it.
 */
export default async function AdminCofferPage({ searchParams }: { searchParams: Promise<{ pot?: string }> }) {
  // In-game clans only (lib/creatorSpaces CREATOR_HIDDEN_ADMIN_PATHS).
  await creatorAway('/admin/coffer');
  const session = await verifyFeeCollector();
  if (!session) redirect(await clanHref('/admin'));
  const clan = await requireClan();
  await requireFeature(clan.id, 'coffer', '/admin/dashboard');

  // The Hardcore Worlds pot only while the clan keeps one; a stale ?pot=hcw falls back to the main pot.
  const hcwCoffer = (await getSetting(clan.id, HCW_COFFER_SETTING_KEY)) === '1';
  const pot: PrizeCurrency = hcwCoffer && (await searchParams).pot === 'hcw' ? 'hcw' : 'gp';

  const [balance, entries, waiting, moneyOut, roster, physicalState] = await Promise.all([
    getCofferBalance(clan.id, pot),
    // The ledger at the bottom of the page: the newest 200 movements.
    listCofferEntries({ clanId: clan.id, limit: 200, currency: pot }),
    // The two queues, read on their own and in full. Filtering them out of the 200 above dropped a
    // donation or a prize from its queue once 200 newer rows existed, with nothing left to say it
    // was still waiting.
    listCofferEntries({ clanId: clan.id, statuses: ['pending', 'reserved', 'planned'], all: true, currency: pot }),
    // And the totals over the whole ledger, for the same reason.
    getCofferMoneyOut(clan.id, pot),
    // Who a donation can be credited to. Guests included: somebody who is not on the roster proper
    // can still have paid into the pot, and refusing to name them is not a policy anyone asked for.
    db
      .select({ id: clanRoster.id, rsn: clanRoster.rsn, kind: clanRoster.kind })
      .from(clanRoster)
      // An event player's seat is not clan membership — not somebody the coffer credits.
      .where(and(eq(clanRoster.clanId, clan.id), isNull(clanRoster.leftAt), rosterClanSeat()))
      .orderBy(asc(clanRoster.rsn)),
    // The in-game Clan Coffer is the main game's alone: Hardcore Worlds has none to read.
    pot === 'gp' ? getPhysicalCofferState(clan.id) : Promise.resolve(null),
  ]);

  return (
    <CofferClient
      pot={pot}
      hcwCoffer={hcwCoffer}
      balance={balance}
      entries={entries}
      waiting={waiting}
      moneyOut={moneyOut}
      roster={roster}
      physicalState={physicalState ? {
        balance: Number(physicalState.balance),
        observedAt: physicalState.observedAt.toISOString(),
      } : null}
    />
  );
}
