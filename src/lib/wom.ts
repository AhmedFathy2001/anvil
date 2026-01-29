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
  team: string;
  gained: number;
}

/**
 * Fetch team standings from WOM competition
 */
export async function fetchWomTeams(competitionId: number): Promise<WomTeamData[]> {
  const url = `https://api.wiseoldman.net/v2/competitions/${competitionId}/csv?table=teams`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WOM API error: ${res.status}`);
  }

  const csv = await res.text();
  return parseWomTeamsCsv(csv);
}

/**
 * Fetch individual player standings from WOM competition
 */
export async function fetchWomPlayers(competitionId: number): Promise<WomPlayerData[]> {
  const url = `https://api.wiseoldman.net/v2/competitions/${competitionId}/csv?table=participants`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WOM API error: ${res.status}`);
  }

  const csv = await res.text();
  return parseWomPlayersCsv(csv);
}

/**
 * Parse WOM teams CSV
 * Format: Rank,Name,Players,Total Gained,Average Gained,MVP
 */
function parseWomTeamsCsv(csv: string): WomTeamData[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const parts = parseCSVLine(line);
    return {
      rank: parseInt(parts[0], 10),
      name: parts[1],
      players: parseInt(parts[2], 10),
      totalGained: parseFloat(parts[3]),
      averageGained: parseFloat(parts[4]),
      mvp: parts[5],
    };
  });
}

/**
 * Parse WOM participants CSV
 * Format: Rank,Player,Team,Gained
 */
function parseWomPlayersCsv(csv: string): WomPlayerData[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const parts = parseCSVLine(line);
    return {
      rank: parseInt(parts[0], 10),
      player: parts[1],
      team: parts[2],
      gained: parseFloat(parts[3]),
    };
  });
}

/**
 * Parse a CSV line, handling potential quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
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
 * Match WOM player names to local player names (case-insensitive, spaces/hyphens normalized)
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
