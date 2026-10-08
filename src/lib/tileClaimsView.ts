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

/** Claims by tile, for the board's markers: tileId → claimer names, oldest claim first. */
export function claimNamesByTile(claims: TeamClaim[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const c of [...claims].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    map.set(c.tileId, [...(map.get(c.tileId) ?? []), c.name]);
  }
  return map;
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
