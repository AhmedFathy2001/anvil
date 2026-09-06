import type { CofferEntry } from '@/db/schema';

// What the coffer channel SAYS about a movement.
//
// Split from the sender for the same reason lib/cofferMath is split from lib/coffer: this is string
// building, and leaving it beside an import of the database meant a test of it could not run
// without a connection string.

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
    case 'pool':
      // Nobody's name on it: a pool is handed to a BOARD, which splits it however that board's
      // prizes say. Saying "the clan" here rather than a winner is the honest version.
      return entry.status === 'cancelled'
        ? `↩️ The **${gp(entry.amount)}** prize pool was called off${note}${left}`
        : entry.status === 'paid'
          ? `✅ **${gp(entry.amount)}** of prize money was paid out${note}${left}`
          : `🎁 **${gp(entry.amount)}** set aside as a prize pool${note}${left}`;
    case 'refund':
      return `↩️ ${gp(entry.amount)} returned to the coffer${note}${left}`;
    default:
      // An adjustment can go either way, and which way is the whole message.
      return entry.amount >= 0
        ? `➕ **${gp(entry.amount)}** added to the coffer${note}${left}`
        : `➖ **${gp(entry.amount)}** taken from the coffer${note}${left}`;
  }
}
