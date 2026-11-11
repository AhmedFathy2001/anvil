// Who may file or remove a submission, given every credential the request carries. Pure: the route
// resolves the credentials, this decides.
//
// A request can carry several at once — a captain cookie, a player-link cookie, a plugin bearer, a
// Discord web session that is a member/captain/staff seat of the team. Each one is good only for its
// own team. The route used to stop looking once it found a cookie, and refuse when that cookie was
// for another team, so a real captain still holding a stale player link for some other team was
// turned away from their own. Now each credential is checked against the target team on its own,
// any one that fits grants, and the ones that don't fit are dropped so nothing downstream attributes
// the submission to them.

type Team = { teamId: number };

export type SubmitCredentials<C extends Team, P extends Team, A extends Team, M> = {
  captain: C | null;
  player: P | null;
  pluginAuth: A | null;
  /** Already scoped to the target team by resolveTeamMembership. */
  membership: M | null;
};

export type SubmitDecision<C extends Team, P extends Team, A extends Team, M> =
  | ({ ok: true } & SubmitCredentials<C, P, A, M>)
  | { ok: false; status: 401 | 403; error: string };

/** Does any team-bound credential already cover `teamId` (so the web-session lookup can be skipped)? */
export function teamCredentialCovers(teamId: number, ...creds: (Team | null | undefined)[]): boolean {
  return creds.some((c) => c != null && c.teamId === teamId);
}

/** Non-admin filing for `teamId`: keep the credentials that are for this team; refuse if none is. */
export function decideSubmitAccess<C extends Team, P extends Team, A extends Team, M>(
  teamId: number,
  creds: SubmitCredentials<C, P, A, M>,
): SubmitDecision<C, P, A, M> {
  const fits = <T extends Team>(c: T | null) => (c && c.teamId === teamId ? c : null);
  const kept = {
    captain: fits(creds.captain),
    player: fits(creds.player),
    pluginAuth: fits(creds.pluginAuth),
    membership: creds.membership,
  };
  if (kept.captain || kept.player || kept.pluginAuth || kept.membership) return { ok: true, ...kept };
  const anyCredential = creds.captain || creds.player || creds.pluginAuth;
  return anyCredential
    ? { ok: false, status: 403, error: 'Cannot submit for another team' }
    : { ok: false, status: 401, error: 'Unauthorized' };
}

/**
 * Non-admin removing a submission on `submission.teamId`: a captain cookie for that team or a
 * managing web seat (captain/staff) removes any of the team's; otherwise only your own, where "you"
 * is the web seat's player row or a player cookie for that team.
 */
export function decideDeleteAccess(
  submission: { teamId: number; playerId: number | null },
  creds: {
    captain: Team | null;
    player: { playerId: number; teamId: number } | null;
    membership: { canManage: boolean; playerId: number | null } | null;
  },
): 'manage' | 'own' | 'denied' {
  if ((creds.captain && creds.captain.teamId === submission.teamId) || creds.membership?.canManage) return 'manage';
  if (submission.playerId == null) return 'denied';
  const mine = [
    creds.membership?.playerId ?? null,
    creds.player && creds.player.teamId === submission.teamId ? creds.player.playerId : null,
  ];
  return mine.includes(submission.playerId) ? 'own' : 'denied';
}
