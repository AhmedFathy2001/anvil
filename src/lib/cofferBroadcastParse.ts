// The clan-chat line OSRS posts to every member when someone uses the Clan Coffer, parsed. Pure, so
// the plugin route and tests share it without a database.
//
//   "Drenvox has deposited 519 coins into the coffer."
//   "Drenvox has withdrawn one coin from the coffer."
//
// Every online member sees it, the person who moved the coins included, and it names them. That makes
// it the one signal that catches a deposit made on mobile, where no plugin is running.

export interface CofferBroadcast {
  actorRsn: string;
  /** The name as rosters compare it: lower case, spaces and underscores folded (auth.normalizeRsn). */
  actorKey: string;
  direction: 'deposit' | 'withdrawal';
  amount: number;
}

const LINE = /^(.{1,12}?) has (deposited|withdrawn) (one coin|([\d,]+) coins) (?:into|from) the coffer\.?$/i;

export function rsnKey(rsn: string): string {
  return rsn.trim().toLowerCase().replace(/[\s_]+/g, ' ');
}

/** Null for anything that isn't exactly a coffer line, so chatter that mentions the coffer is ignored. */
export function parseCofferBroadcast(line: string): CofferBroadcast | null {
  const plain = line.replace(/<[^>]*>/g, '').replace(/ /g, ' ').replace(/^\[[^\]]*\]\s*/, '').trim();
  const m = LINE.exec(plain);
  if (!m) return null;
  const amount = m[4] ? Number(m[4].replace(/,/g, '')) : 1;
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const actorRsn = m[1].trim();
  return { actorRsn, actorKey: rsnKey(actorRsn), direction: m[2].toLowerCase() === 'deposited' ? 'deposit' : 'withdrawal', amount };
}

/**
 * How a confirmed deposit splits: coins the depositor took out earlier and is putting back are custody
 * coming home (the ledger already counts them), only the rest is a donation.
 */
export function splitDeposit(amount: number, heldByActor: number): { returned: number; donated: number } {
  const returned = Math.min(amount, Math.max(0, heldByActor));
  return { returned, donated: amount - returned };
}
