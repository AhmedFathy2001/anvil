// The "people you have blocked" list on /challenges. Blocks are stored as player ids only, so the list
// names each by a public character: a verified one, the main character first. Nothing else about them.
// A person with no such character (account gone) shows as "Deleted account". PURE: tests/h2h-blocked.test.ts.

export const DELETED_ACCOUNT = 'Deleted account';

export interface BlockedPerson {
  playerId: number;
  name: string;
}

export interface CharacterRow {
  playerId: number;
  rsn: string;
  verifiedAt: string | Date | null;
  provisional: number;
  isPrimary: number;
}

export function blockedPeople(blocked: readonly number[], rows: readonly CharacterRow[]): BlockedPerson[] {
  return blocked.map((playerId) => {
    const mine = rows
      .filter((r) => r.playerId === playerId && r.verifiedAt && r.provisional === 0)
      .sort((a, b) => b.isPrimary - a.isPrimary || a.rsn.localeCompare(b.rsn));
    return { playerId, name: mine[0]?.rsn ?? DELETED_ACCOUNT };
  });
}
