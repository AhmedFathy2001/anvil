// What a co-host clan's Discord will do for one board, as the HOST sees it (lib/partnerDiscordReadiness
// gathers the facts). Pure, so the wording of each state is tested without a database.

export type PartnerPosts = 'host-off' | 'partner-off' | 'no-channel' | 'own-channel' | 'default-channel';

export interface PartnerFacts {
  /** The host's cap for partners (lib/discordPostPolicy partnerShare; 'none' = keeps posts to itself). */
  hostShare: 'all' | 'big' | 'none';
  /** The partner's preset for this board ('host' when it never chose). */
  preset: 'host' | 'big' | 'off';
  /** It picked a channel for this board. */
  ownChannel: boolean;
  /** Its clan-wide co-hosted boards channel exists and is switched on. */
  defaultChannel: boolean;
  botConnected: boolean;
  playerRoleReady: boolean;
  /** Its own teams on the board that can have channels in its server (0 = not applicable). */
  ownTeams: number;
  /** How many of those have their role + text + voice built. */
  teamsBuilt: number;
  autoTeamChannels: boolean;
}

export function partnerPosts(f: PartnerFacts): PartnerPosts {
  if (f.hostShare === 'none') return 'host-off';
  if (f.preset === 'off') return 'partner-off';
  if (f.ownChannel) return 'own-channel';
  return f.defaultChannel ? 'default-channel' : 'no-channel';
}

/**
 * One word for the row: 'ready' when everything that applies is set up, 'partial' when something is
 * missing, 'nothing' when the partner's Discord does nothing for this board.
 */
export function partnerVerdict(f: PartnerFacts): 'ready' | 'partial' | 'nothing' {
  const posts = partnerPosts(f);
  const posting = posts === 'own-channel' || posts === 'default-channel';
  const teamsDone = f.ownTeams === 0 || f.teamsBuilt >= f.ownTeams;
  if (!posting && !f.playerRoleReady && f.teamsBuilt === 0) return 'nothing';
  // A missing channel is only a gap when posts would otherwise go there.
  const postsOk = posting || posts === 'host-off' || posts === 'partner-off';
  return postsOk && teamsDone ? 'ready' : 'partial';
}

export const POSTS_LABEL: Record<PartnerPosts, string> = {
  'host-off': 'Not shared with partners',
  'partner-off': 'Turned off by them',
  'no-channel': 'No channel set',
  'own-channel': 'Own channel for this board',
  'default-channel': 'Their co-hosted boards channel',
};
