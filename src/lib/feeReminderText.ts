// "Remind unpaid" on Admin → Fees: the pure half (who gets a message, what it says, and whether the
// cooldown is still running). The DB + Discord half is lib/feeReminders. Kept apart so the rules can
// be tested without a database.
//
// ONE DM PER PERSON, not per fee. Someone who entered three accounts owes three fees, and three
// identical DMs from a bot in a row reads as spam, so their fees are added up into one message.
//
// A COOLDOWN PER EVENT. A treasurer chasing a board will press the button again the next time they
// look at the page; without a limit the same people get pinged every time. Once per 12 hours per
// event, stamped as a clan audit row (which also shows in the Activity log as who chased whom).

import { EMBED_COLOR } from '@/lib/discordEmbeds';

export const FEE_REMIND_EVENT = 'fee_reminders_sent';
export const FEE_REMIND_COOLDOWN_MS = 12 * 3_600_000;

export interface UnpaidFeeRow {
  userId: number | null;
  discordId: string | null;
  amount: number;
}

export interface FeeRecipient {
  userId: number;
  discordId: string;
  /** Every unpaid fee this person holds on the event, added up. */
  amount: number;
  fees: number;
}

/**
 * Collapse unpaid fee rows into one recipient per person. Rows with no linked user (a sign-up made
 * for a roster name) or no Discord id can't be messaged and are counted as `unreachable` instead.
 */
export function groupFeeRecipients(rows: UnpaidFeeRow[]): { recipients: FeeRecipient[]; unreachable: number } {
  const byUser = new Map<number, FeeRecipient>();
  let unreachable = 0;
  for (const r of rows) {
    if (r.userId == null || !r.discordId) {
      unreachable++;
      continue;
    }
    const cur = byUser.get(r.userId);
    if (cur) {
      cur.amount += r.amount;
      cur.fees++;
    } else {
      byUser.set(r.userId, { userId: r.userId, discordId: r.discordId, amount: r.amount, fees: 1 });
    }
  }
  return { recipients: [...byUser.values()], unreachable };
}

/**
 * The audit table stores times two ways (SQL default 'YYYY-MM-DD HH:MM:SS' in UTC, or a JS ISO
 * string). Both are UTC; the space form has no zone marker, so add one before parsing.
 */
export function parseAuditTime(s: string): number {
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  return Date.parse(iso);
}

/** Milliseconds until reminding is allowed again for an event last reminded at `lastAt`; 0 = now. */
export function cooldownRemainingMs(lastAt: string | null, now: number): number {
  if (!lastAt) return 0;
  const t = parseAuditTime(lastAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t + FEE_REMIND_COOLDOWN_MS - now);
}

/** "3h 20m" / "45m" — how long until the button works again. */
export function formatWait(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

const gp = (n: number) => `${n.toLocaleString('en-US')} gp`;

/** The DM: which event, how much, and where to go. Plain words; no staff jargon. */
export function feeReminderEmbed(p: {
  clanName: string;
  eventName: string;
  amount: number;
  fees: number;
  url: string;
}): Record<string, unknown> {
  const owed = p.fees > 1 ? `${gp(p.amount)} (for ${p.fees} accounts)` : gp(p.amount);
  return {
    title: `Entry fee for ${p.eventName}`,
    url: p.url,
    color: EMBED_COLOR.amber,
    description: [
      `Hi! **${p.clanName}** hasn’t got your entry fee for **${p.eventName}** yet: **${owed}**.`,
      'Trade it in-game to one of the clan’s staff, then pick who you paid on your sign-up so they know to look for it.',
      `[Open your sign-up](${p.url})`,
      'Already paid? Ignore this, staff will catch up.',
    ].join('\n\n'),
  };
}
