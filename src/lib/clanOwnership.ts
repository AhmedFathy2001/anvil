// The one primitive that moves a clan's protected owner seat from one person to another.
//
// Used by the end of a transfer request's hold (lib/ownershipTransfers). The role-change and delete
// endpoints refuse to touch the owner row, so this is the only way ownership changes hands (apart
// from /api/staff/clans/[id]/owner, which only appoints one for a clan that has NONE).

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanStaff } from '@/db/schema';

type MoveFailure = 'target-not-admin' | 'from-not-owner' | 'superseded';
export type MoveOwnershipResult = { ok: true } | { ok: false; reason: MoveFailure };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Crown `toUserId` (who must be an admin of `clanId` right now) and make `fromUserId` (who must be
 * its owner right now) an ordinary admin — in one transaction, so the clan is never left with two
 * owners or none. Either guard failing rolls the whole thing back.
 *
 * `alongside` runs inside the same transaction (a transfer request marking itself completed); when it
 * returns false the move is rolled back as 'superseded', so the record and the seats never disagree.
 */
export async function moveClanOwnership(
  clanId: number,
  fromUserId: number,
  toUserId: number,
  alongside?: (tx: Tx) => Promise<boolean>,
): Promise<MoveOwnershipResult> {
  if (fromUserId === toUserId) return { ok: false, reason: 'target-not-admin' };
  try {
    await db.transaction(async (tx) => {
      // Crown the target first (still requiring they're an admin), and bail out if that matched no
      // row — they were demoted out from under us.
      const crowned = await tx
        .update(clanStaff)
        .set({ role: 'owner' })
        .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, toUserId), eq(clanStaff.role, 'admin')))
        .returning({ id: clanStaff.id });
      if (crowned.length !== 1) throw new MoveError('target-not-admin');
      // Then the outgoing owner becomes a plain admin — only if they still ARE the owner, or the
      // clan would end up with two.
      const demoted = await tx
        .update(clanStaff)
        .set({ role: 'admin' })
        .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, fromUserId), eq(clanStaff.role, 'owner')))
        .returning({ id: clanStaff.id });
      if (demoted.length !== 1) throw new MoveError('from-not-owner');
      if (alongside && !(await alongside(tx))) throw new MoveError('superseded');
    });
  } catch (err) {
    if (err instanceof MoveError) return { ok: false, reason: err.reason };
    throw err;
  }
  return { ok: true };
}

class MoveError extends Error {
  constructor(readonly reason: MoveFailure) {
    super(reason);
  }
}
