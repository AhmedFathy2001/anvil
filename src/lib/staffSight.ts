// What each staff tier is shown about the people it looks after.
//
// The owner's rule: members' data is protected "even from their own admins". Staff see what they
// need to run the clan and its events; evidence of cheating in the clan's OWN events stays visible
// to that event's staff; everything else is trimmed. These are the trims that depend on WHO is
// looking, kept in one pure file so a route cannot quietly disagree with the next one over.
//
// PURE — no database — so tests/staff-sight.test.ts holds each rule.

import { atLeast, hasPlatformRole } from '@/lib/clanRoles';

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

/**
 * Who a TEAM's private chat line is pushed to live, besides that team's own players.
 *
 * It used to be every moderator of the host clan, on every board the clan ran: a team's planning
 * talk arrived in the client of people with no job on that event. Now it is the people running
 * THIS board — the clan's admins and owner, who run every event, and any moderator-tier staff
 * holding a grant on this board (event_editors). Nothing else about chat moderation changes: a
 * moderator can still open any channel and the moderation page, and delete or time out, when there
 * is something to look at. Looking is then something they did, not something sent to them.
 */
export function teamChatStaffListeners(
  staff: { userId: number; role: string | null | undefined }[],
  boardGrantUserIds: Iterable<number>,
): number[] {
  const granted = new Set(boardGrantUserIds);
  return staff
    .filter((s) => atLeast(s.role, 'admin') || (atLeast(s.role, 'moderator') && granted.has(s.userId)))
    .map((s) => s.userId);
}

// ── Platform side ──────────────────────────────────────────────────────────────────────────────

/**
 * An email address with its name hidden: "j•••@gmail.com". Enough to recognise an address you
 * already know, not enough to write to it or look the person up.
 */
export function maskEmail(email: string | null | undefined): string | null {
  const value = email?.trim();
  if (!value) return null;
  const at = value.lastIndexOf('@');
  if (at <= 0) return '•••';
  return `${value[0]}•••${value.slice(at)}`;
}

/**
 * A clan owner's personal email (it arrives with their Discord login) and the clan's billing
 * contact, on the operator pages. Whole for the top platform role, which is also the only one that
 * handles billing; masked for every other operator login. The owner's Discord profile link stays
 * the way to reach them.
 */
export function operatorEmail(platformRole: string | null | undefined, email: string | null | undefined): string | null {
  return hasPlatformRole(platformRole, 'root') ? email?.trim() || null : maskEmail(email);
}

/** Is this the whole address (so a mailto link makes sense), not a masked one? */
export function isWholeEmail(email: string | null | undefined): boolean {
  return !!email && !email.includes('•');
}
