import { sendCofferWebhook } from '@/lib/discord';
import type { CofferEntry } from '@/db/schema';

// The coffer's optional Discord feed.
//
// OPT-IN AND FIRE-AND-FORGET. A clan that has not set the channel gets nothing, and a webhook that
// is down must never fail the write that triggered it: the ledger is the record, this is only the
// telling. Every caller awaits nothing and catches everything.
//
// Says WHO, HOW MUCH and WHAT IT LEAVES — the three things somebody reading a money channel wants
// without opening the site.

const gp = (n: number) => `${Math.abs(Math.round(n)).toLocaleString()} gp`;

/** One line per movement, with the balance it leaves behind. */
export function cofferLine(entry: CofferEntry, balanceAfter: number | null): string {
  const who = entry.rsn ? `**${entry.rsn}**` : 'The clan';
  const note = entry.note ? ` — ${entry.note}` : '';
  const left = balanceAfter == null ? '' : `\n> Coffer now holds **${gp(balanceAfter)}**.`;

  switch (entry.kind) {
    case 'donation':
      return entry.status === 'approved'
        ? `💰 ${who} donated **${gp(entry.amount)}**${note}${left}`
        : entry.status === 'rejected'
          ? `🚫 ${who}'s **${gp(entry.amount)}** donation was rejected${note}`
          : `📥 ${who} reported a **${gp(entry.amount)}** donation — waiting on staff${note}`;
    case 'award':
      if (entry.status === 'unfunded') {
        // Worth saying out loud: somebody won and the pot could not pay them.
        return `⚠️ ${who} won **${gp(entry.amount)}**${note} — the coffer could not cover it${left}`;
      }
      return entry.status === 'paid'
        ? `✅ ${who} was paid **${gp(entry.amount)}**${note}${left}`
        : `🏆 ${who} is owed **${gp(entry.amount)}**${note}${left}`;
    case 'refund':
      return `↩️ ${gp(entry.amount)} returned to the coffer${note}${left}`;
    default:
      // An adjustment can go either way, and which way is the whole message.
      return entry.amount >= 0
        ? `➕ **${gp(entry.amount)}** added to the coffer${note}${left}`
        : `➖ **${gp(entry.amount)}** taken from the coffer${note}${left}`;
  }
}

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
