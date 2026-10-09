// The pure half of lib/tileClaims — types and shaping only, no database — so the team page's client
// components can use it.

export const NOTE_MAX = 80;

export interface TeamClaim {
  tileId: number;
  userId: number;
  name: string;
  note: string | null;
  createdAt: string;
  mine: boolean;
}

/** Trim a note to something that fits on a tile chip; empty means none. */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const note = raw.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
  return note || null;
}

/** One claimer on one tile, for the board's markers. */
export interface ClaimMarker {
  name: string;
  mine: boolean;
}

/** Claims by tile, for the board's markers: tileId → claimers, oldest claim first. */
export function claimMarkersByTile(claims: TeamClaim[]): Map<number, ClaimMarker[]> {
  const map = new Map<number, ClaimMarker[]>();
  for (const c of [...claims].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    map.set(c.tileId, [...(map.get(c.tileId) ?? []), { name: c.name, mine: c.mine }]);
  }
  return map;
}

/** Two-letter tag for a claimer: "Fried Silver" → FS, "VeXiuSeD" → VE, "H A R L EM" → HA. */
export function claimInitials(name: string): string {
  const words = name.trim().split(/[\s_-]+/).filter(Boolean);
  const tag = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return tag.toUpperCase();
}

/** A stable colour per person, so the same teammate reads the same everywhere. */
export function claimColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 42%)`;
}

/** Claims by person, for the "who's going for what" panel: name → their claims, yours first. */
export function claimsByPerson(claims: TeamClaim[]): { userId: number; name: string; mine: boolean; claims: TeamClaim[] }[] {
  const people = new Map<number, { userId: number; name: string; mine: boolean; claims: TeamClaim[] }>();
  for (const c of claims) {
    const p = people.get(c.userId) ?? { userId: c.userId, name: c.name, mine: c.mine, claims: [] };
    p.claims.push(c);
    people.set(c.userId, p);
  }
  return [...people.values()].sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
}
