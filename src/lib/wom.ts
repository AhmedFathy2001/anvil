// Wise Old Man API integration

export interface WomTeamData {
  rank: number;
  name: string;
  players: number;
  totalGained: number;
  averageGained: number;
  mvp: string;
}

export interface WomPlayerData {
  rank: number;
  player: string;
  displayName: string;
  team: string;
  gained: number;
}

interface WomCompetitionResponse {
  id: number;
  title: string;
  metric: string;
  startsAt: string;
  endsAt: string;
  participations: {
    teamName: string;
    player: {
      username: string;
      displayName: string;
    };
    progress: {
      gained: number;
    };
  }[];
}

/**
 * Fetch competition data from WOM API
 */
async function fetchCompetition(competitionId: number): Promise<WomCompetitionResponse> {
  const url = `https://api.wiseoldman.net/v2/competitions/${competitionId}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WOM API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch team standings from WOM competition
 */
export async function fetchWomTeams(competitionId: number): Promise<WomTeamData[]> {
  const data = await fetchCompetition(competitionId);

  // Group participations by team
  const teamMap = new Map<string, { players: string[]; totalGained: number; gains: { name: string; gained: number }[] }>();

  for (const p of data.participations) {
    const teamName = p.teamName || 'No Team';
    const existing = teamMap.get(teamName) || { players: [], totalGained: 0, gains: [] };

    existing.players.push(p.player.displayName);
    existing.totalGained += p.progress.gained;
    existing.gains.push({ name: p.player.displayName, gained: p.progress.gained });

    teamMap.set(teamName, existing);
  }

  // Convert to array and sort by total gained
  const teams = Array.from(teamMap.entries())
    .map(([name, data]) => {
      // Find MVP (player with highest gains)
      const mvp = data.gains.reduce((best, curr) =>
        curr.gained > best.gained ? curr : best,
        { name: 'N/A', gained: -1 }
      );

      return {
        name,
        players: data.players.length,
        totalGained: data.totalGained,
        averageGained: data.players.length > 0 ? data.totalGained / data.players.length : 0,
        mvp: mvp.name,
      };
    })
    .sort((a, b) => b.totalGained - a.totalGained)
    .map((team, index) => ({ ...team, rank: index + 1 }));

  return teams;
}

/**
 * Fetch individual player standings from WOM competition
 */
export async function fetchWomPlayers(competitionId: number): Promise<WomPlayerData[]> {
  const data = await fetchCompetition(competitionId);

  // Sort by gained descending
  const sorted = [...data.participations]
    .sort((a, b) => b.progress.gained - a.progress.gained);

  return sorted.map((p, index) => ({
    rank: index + 1,
    player: p.player.username,
    displayName: p.player.displayName,
    team: p.teamName || 'No Team',
    gained: p.progress.gained,
  }));
}

/**
 * Normalize RSN for comparison - OSRS is case-insensitive only
 */
function normalizeRsn(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Match WOM team names to local team names (case-insensitive, fuzzy)
 */
export function matchTeamName(womTeamName: string, localTeamNames: string[]): string | null {
  const normalizedWom = normalizeRsn(womTeamName);

  // Exact match first (normalized)
  for (const localName of localTeamNames) {
    if (normalizeRsn(localName) === normalizedWom) {
      return localName;
    }
  }

  // Partial match (WOM name contains local name or vice versa)
  for (const localName of localTeamNames) {
    const normalizedLocal = normalizeRsn(localName);
    if (normalizedWom.includes(normalizedLocal) || normalizedLocal.includes(normalizedWom)) {
      return localName;
    }
  }

  return null;
}

/**
 * Match WOM player names to local player names (case-insensitive)
 */
export function matchPlayerName(womPlayerName: string, localPlayerNames: string[]): string | null {
  const normalizedWom = normalizeRsn(womPlayerName);

  for (const localName of localPlayerNames) {
    if (normalizeRsn(localName) === normalizedWom) {
      return localName;
    }
  }

  return null;
}
