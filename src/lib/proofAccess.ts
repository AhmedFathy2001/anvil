import { atLeast, type ClanRole } from '@/lib/clanRoles';

// Who may remove a proof (a submission) — the rule the web's DELETE /api/events/:id/submissions
// applies, written once as a pure function so the plugin's panel asks exactly the same question.
// Pure: no database, so it is tested on its own (tests/proof-access.test.ts).

/** The viewer's grant in the event's HOST clan, as lib/clanGrants reads it; null when they hold none. */
export interface HostGrant {
  role: ClanRole | string;
  editorScope?: 'all' | 'assigned' | string | null;
  treasurerScope?: 'all' | 'assigned' | string | null;
}

/**
 * Host-clan staff from moderator up remove any proof on the clan's boards — the verifyAdminOrModerator
 * rule: a GLOBAL editor counts, a grant scoped to one board (editor or treasurer) does not.
 */
export function isProofModerator(grant: HostGrant | null): boolean {
  if (!grant) return false;
  if (grant.role === 'editor') return grant.editorScope !== 'assigned';
  if (grant.role === 'treasurer' && grant.treasurerScope === 'assigned') return false;
  return atLeast(grant.role as ClanRole, 'moderator');
}

export interface ProofDeleteCheck {
  /** The viewer's login; null when the token has none linked. */
  userId: number | null;
  /** The viewer's own player rows on this event (the character they play, and any other they own there). */
  playerIds: readonly number[];
  /** Captain and team-staff users of the SUBMISSION's team (lib/teamStaff teamManagerIds). */
  managers: ReadonlySet<number>;
  grant: HostGrant | null;
  submission: { playerId: number | null };
}

/** The submitter themselves, their team's captain or staff, or host-clan moderators and up. */
export function canDeleteProof(c: ProofDeleteCheck): boolean {
  if (isProofModerator(c.grant)) return true;
  if (c.userId != null && c.managers.has(c.userId)) return true;
  return c.submission.playerId != null && c.playerIds.includes(c.submission.playerId);
}

/** How the removal is signed in the Discord audit line ("by Emberfall Captain (captain)"). */
export function proofDeleterRole(c: ProofDeleteCheck, team: { captainUserId: number | null } | null): 'admin' | 'captain' | 'team staff' | 'player' {
  if (isProofModerator(c.grant)) return 'admin';
  if (c.userId != null && c.managers.has(c.userId)) return team?.captainUserId === c.userId ? 'captain' : 'team staff';
  return 'player';
}
