import { sendCofferWebhook } from '@/lib/discord';
import type { CofferEntry } from '@/db/schema';
import { cofferLine } from '@/lib/cofferFeedText';

// The coffer's optional Discord feed.
//
// OPT-IN AND FIRE-AND-FORGET. A clan that has not set the channel gets nothing, and a webhook that
// is down must never fail the write that triggered it: the ledger is the record, this is only the
// telling. Every caller awaits nothing and catches everything.

export { cofferLine } from '@/lib/cofferFeedText';

/**
 * Tell the coffer channel about a movement.
 *
 * Never throws and never blocks the ledger write — a webhook outage is not a reason to lose a
 * donation. Callers may await it or not; it resolves either way.
 */
export async function announceCofferMovement(
  clanId: number,
  entry: CofferEntry,
  balanceAfter: number | null = null,
): Promise<void> {
  try {
    await sendCofferWebhook(clanId, { content: cofferLine(entry, balanceAfter) });
  } catch {
    // The ledger already has the truth; this was only the telling.
  }
}
