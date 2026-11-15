// What each staff tier is shown about the people it looks after.
//
// The owner's rule: members' data is protected "even from their own admins". Staff see what they
// need to run the clan and its events; evidence of cheating in the clan's OWN events stays visible
// to that event's staff; everything else is trimmed. These are the trims that depend on WHO is
// looking, kept in one pure file so a route cannot quietly disagree with the next one over.
//
// PURE — no database — so tests/staff-sight.test.ts holds each rule.

import { atLeast } from '@/lib/clanRoles';

/**
 * A member's Discord handle is contact detail, not something approving a sign-up or grading a proof
 * needs: the display name and RSN identify the row. Admins and the owner keep it — they are who
 * resolves "which Discord account is this?" when a link goes wrong.
 */
export function seesDiscordHandle(role: string | null | undefined): boolean {
  return atLeast(role, 'admin');
}

/**
 * Who works the fee ledger: the people who chase and confirm payments. A moderator approves
 * sign-ups and grades proofs; who has paid what is not theirs to read.
 */
export function seesFeeLedger(role: string | null | undefined): boolean {
  return role === 'treasurer' || atLeast(role, 'admin');
}

/** The handle, or null when this viewer is not shown handles. */
export function handleFor(viewerRole: string | null | undefined, discordUsername: string | null | undefined): string | null {
  return seesDiscordHandle(viewerRole) ? discordUsername ?? null : null;
}

/**
 * A person on the admin people list, as far as their Discord identity and activity go.
 *
 * The list covers everyone with a presence in the clan, plain members included, and it used to send
 * each one's Discord id, avatar hash and last sign-in time to every admin. An admin grants roles and
 * picks captains from this list by name and handle; the id is never drawn, and when a plain member
 * last signed in is nobody's to watch. Staff rows keep their avatar and last sign-in — an owner
 * needs to see whether the people holding keys are still around. (A Discord avatar address contains
 * the Discord id, which is why a plain member gets no avatar here rather than a ready-made URL.)
 */
export function peopleListIdentity(
  row: { role: string | null | undefined; discordId: string | null; discordAvatar: string | null; lastLoginAt: string | null },
  avatarUrl: (discordId: string, avatarHash: string | null) => string | null,
): { hasDiscord: boolean; avatarUrl: string | null; lastLoginAt: string | null } {
  const staff = !!row.role && row.role !== 'member';
  return {
    hasDiscord: !!row.discordId,
    avatarUrl: staff && row.discordId ? avatarUrl(row.discordId, row.discordAvatar) : null,
    lastLoginAt: staff ? row.lastLoginAt : null,
  };
}
