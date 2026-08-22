// Attaching an RSN to a person, from anywhere.
//
// Three surfaces do this and they must agree: the website's "manual review" form, the Discord role
// panel's modal, and (in future) anything else that learns an RSN from someone who has proven who
// they are on Discord but not that they own the account.
//
// The rules that must not drift between them:
//   - Verification proves ACCOUNT OWNERSHIP, never clan membership. A claim starts as a guest;
//     only an in-game roster sync promotes it (see the roster note in lib/discordContext).
//   - An RSN already owned by someone else is refused outright rather than reassigned. Silently
//     moving an account between people is how a clan loses track of who did what.
//   - A ghost row (an unclaimed member the roster already knew about) is claimed in place rather
//     than duplicated, so the history attached to it survives.
//   - Everything lands `provisional`, in the moderator queue. Nothing here asserts an account is
//     verified, because nothing here checked.

import { db } from '@/db';
import { clanAuditLog, clanMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { onCharacterLinked } from '@/lib/identity';

export type RsnClaimResult =
  | { ok: true; clanMemberId: number; created: boolean }
  | { ok: false; reason: 'invalid-rsn' | 'owned-by-someone-else' };

/** OSRS names are 1–12 characters. Anything else is a typo, not a name. */
export function isPlausibleRsn(rsn: string): boolean {
  const trimmed = rsn.trim();
  return trimmed.length >= 1 && trimmed.length <= 12;
}

/**
 * Attach `rsn` to `userId`, creating or claiming the clan_members row.
 *
 * `note` is the reason the claim exists, shown to whoever reviews it — "asked for it in #roles"
 * is a much better queue entry than a bare RSN, because the reviewer's first question is always
 * "where did this come from".
 */
export async function claimRsnForUser(params: {
  userId: number;
  rsn: string;
  note?: string | null;
  /** Who performed it, for the audit trail. Defaults to the claimant. */
  actorUserId?: number | null;
  /** Audit event name, so the log distinguishes the website form from the Discord panel. */
  auditEvent?: string;
}): Promise<RsnClaimResult> {
  const rsn = params.rsn.trim();
  if (!isPlausibleRsn(rsn)) return { ok: false, reason: 'invalid-rsn' };

  const rsnNormalized = normalizeRsn(rsn);
  const nowIso = new Date().toISOString();
  const note = (params.note ?? '').trim().slice(0, 500) || null;

  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
  });

  // Hard block: this account belongs to someone else. Never reassign.
  if (existing?.userId && existing.userId !== params.userId) {
    return { ok: false, reason: 'owned-by-someone-else' };
  }

  let clanMemberId: number;
  let created = false;

  if (existing) {
    await db
      .update(clanMembers)
      .set({
        userId: params.userId,
        verificationMethod: 'manual',
        provisional: 1,
        // Never overwrite a real verification with a fresh claim.
        verifiedAt: existing.verifiedAt,
        claimedAt: existing.claimedAt ?? nowIso,
        notes: note || existing.notes,
        // Bring a soft-deleted ghost back into the active set on claim, unless an admin removed
        // them by hand (source 'manual' means a human put them there deliberately).
        leftAt: existing.source === 'manual' ? existing.leftAt : null,
      })
      .where(eq(clanMembers.id, existing.id));
    clanMemberId = existing.id;
  } else {
    const inserted = await db
      .insert(clanMembers)
      .values({
        rsn,
        rsnNormalized,
        source: 'manual',
        // A guest until the in-game roster says otherwise. See the note at the top.
        isGuest: 1,
        lastSeenInClan: nowIso,
        userId: params.userId,
        verificationMethod: 'manual',
        provisional: 1,
        claimedAt: nowIso,
        notes: note,
      })
      .returning({ id: clanMembers.id });
    clanMemberId = inserted[0].id;
    created = true;
  }

  // The character now has an owner: adopt its guest sign-ups and advertise the membership.
  await onCharacterLinked(clanMemberId, params.userId);

  db.insert(clanAuditLog)
    .values({
      clanMemberId,
      eventType: params.auditEvent ?? 'manual_requested',
      newValue: JSON.stringify({ userId: params.userId, rsn }),
      actorUserId: params.actorUserId ?? params.userId,
      notes: note,
    })
    .catch(() => {});

  return { ok: true, clanMemberId, created };
}
