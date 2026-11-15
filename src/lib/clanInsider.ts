// The reads behind lib/rosterVisibility: is this viewer inside the clan, and which of its seated
// characters has the owner kept off public view?

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { clanGrant } from '@/lib/clanGrants';
import { viewerMemberIds } from '@/lib/competitionView';
import { hiddenNameSet } from '@/lib/rosterVisibility';
import { clanSeat } from '@/lib/seatScope';

/**
 * Is the signed-in viewer inside this clan: a live member or guest seat, a staff grant here, or
 * platform staff? Signed out is always outside.
 */
export async function viewerIsClanInsider(clanId: number): Promise<boolean> {
  const session = await verifyUser();
  if (!session) return false;
  if ((await viewerMemberIds(clanId, session)).length > 0) return true;
  if (await clanGrant(clanId, session.userId)) return true;
  // clan-scope: global -- a platform role is not a clan's.
  const row = await db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { platformRole: true } });
  return !!row?.platformRole && row.platformRole !== 'none';
}

/** Every live-seated character of this clan whose "Show publicly" switch is off, as name keys. */
export async function unsharedRosterNames(clanId: number): Promise<Set<string>> {
  const rows = await db
    .select({ rsn: accounts.rsn })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt), clanSeat(), eq(accounts.shared, false)));
  return hiddenNameSet(rows.map((r) => r.rsn));
}

/**
 * The names this viewer must not be shown on this clan's public pages: none for an insider, the
 * unshared roster for everyone else. `insider` may be passed when the caller already knows (an
 * image or card rendered for nobody in particular is always an outsider's view).
 */
export async function hiddenNamesForViewer(clanId: number, insider?: boolean): Promise<Set<string>> {
  if (insider ?? (await viewerIsClanInsider(clanId))) return new Set();
  return unsharedRosterNames(clanId);
}

/**
 * Is this one character's page in this clan closed to the viewer? True when its owner switched
 * "Show publicly" off and the viewer is outside the clan. (Covers a departed seat too, which the
 * roster list above does not carry.)
 */
export async function characterHiddenFromViewer(clanId: number, accountId: number, insider?: boolean): Promise<boolean> {
  // clan-scope: global -- one account's own switch, read by its id.
  const row = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId), columns: { shared: true } });
  if (!row || row.shared) return false;
  return !(insider ?? (await viewerIsClanInsider(clanId)));
}
