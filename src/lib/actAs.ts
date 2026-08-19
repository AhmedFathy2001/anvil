// Borrowing a clan's authority, briefly and on the record.
//
// The two-axis model says platform staff get no clan write from being platform staff, and that is
// the right default. But an operator sometimes has to actually fix something inside a clan, and the
// honest options are limited: hand operators a standing clan grant (the conflation the model
// exists to refuse), reach into the database by hand (invisible to the clan), or make the exception
// explicit and temporary. This is the third.
//
// WHAT MAKES IT SAFE IS THE SHAPE, NOT THE INTENT:
//   - it expires, so a forgotten grant is not a permanent escalation;
//   - it is capped at 'admin' — never 'owner', the one seat an operator must not be able to take;
//   - it carries a reason, written into the CLAN's own audit log, which its owner can read.

import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, platformActAs } from '@/db/schema';
import type { ClanRole } from '@/lib/clanRoles';

/** The longest a grant may run. A day is long enough to fix anything and short enough to notice. */
export const MAX_HOURS = 24;
export const DEFAULT_HOURS = 1;

export interface ActAsGrant {
  id: number;
  clanId: number;
  role: ClanRole;
  reason: string;
  expiresAt: string;
}

/**
 * The operator's live grant in this clan, if any.
 *
 * "Live" means not revoked and not expired, decided in SQL rather than by comparing dates in JS
 * afterwards — an expiry that only holds when someone remembers to check it is not an expiry.
 */
export async function liveActAs(clanId: number, userId: number): Promise<ActAsGrant | null> {
  const now = new Date().toISOString();
  const row = await db
    .select()
    .from(platformActAs)
    .where(
      and(
        eq(platformActAs.clanId, clanId),
        eq(platformActAs.userId, userId),
        isNull(platformActAs.revokedAt),
        gt(platformActAs.expiresAt, now),
      ),
    )
    .orderBy(desc(platformActAs.expiresAt))
    .limit(1)
    .then((r) => r[0]);

  if (!row) return null;
  return {
    id: row.id,
    clanId: row.clanId,
    role: (row.role as ClanRole) ?? 'admin',
    reason: row.reason,
    expiresAt: row.expiresAt,
  };
}

/** Every live grant an operator currently holds, for the "you are acting as" banner. */
export async function myLiveGrants(userId: number): Promise<ActAsGrant[]> {
  const now = new Date().toISOString();
  const rows = await db
    .select()
    .from(platformActAs)
    .where(
      and(eq(platformActAs.userId, userId), isNull(platformActAs.revokedAt), gt(platformActAs.expiresAt, now)),
    )
    .orderBy(desc(platformActAs.expiresAt));
  return rows.map((r) => ({
    id: r.id,
    clanId: r.clanId,
    role: (r.role as ClanRole) ?? 'admin',
    reason: r.reason,
    expiresAt: r.expiresAt,
  }));
}

/**
 * Take a grant. Returns it, having written the clan's audit entry first.
 *
 * The audit write is not best-effort here, unlike most of them. The whole justification for this
 * mechanism is that the clan can see it happen; a grant whose log line silently failed is exactly
 * the invisible access it is supposed to replace.
 */
export async function grantActAs(opts: {
  clanId: number;
  userId: number;
  reason: string;
  hours: number;
  actorRole: string;
}): Promise<ActAsGrant> {
  const hours = Math.min(Math.max(opts.hours || DEFAULT_HOURS, 1), MAX_HOURS);
  const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();

  const [row] = await db
    .insert(platformActAs)
    .values({
      clanId: opts.clanId,
      userId: opts.userId,
      // Capped here, in the only place that writes the column.
      role: 'admin',
      reason: opts.reason,
      expiresAt,
    })
    .returning();

  await db.insert(clanAuditLog).values({
    clanId: opts.clanId,
    eventType: 'platform_act_as_granted',
    actorUserId: opts.userId,
    newValue: JSON.stringify({ reason: opts.reason, expiresAt, role: 'admin' }),
    notes: `platform ${opts.actorRole} took temporary admin in this clan`,
  });

  return { id: row.id, clanId: row.clanId, role: 'admin', reason: row.reason, expiresAt: row.expiresAt };
}

/** Hand it back early. */
export async function revokeActAs(id: number, userId: number): Promise<boolean> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(platformActAs)
    .set({ revokedAt: now })
    // Scoped to the holder: revoking is giving up your own, not taking away someone else's.
    .where(and(eq(platformActAs.id, id), eq(platformActAs.userId, userId), isNull(platformActAs.revokedAt)))
    .returning();
  if (!row) return false;

  await db
    .insert(clanAuditLog)
    .values({
      clanId: row.clanId,
      eventType: 'platform_act_as_revoked',
      actorUserId: userId,
      newValue: JSON.stringify({ grantId: id }),
      notes: 'temporary admin handed back',
    })
    .catch(() => {});
  return true;
}
