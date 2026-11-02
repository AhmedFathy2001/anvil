// Where each of a person's characters stands with the clans on Anvil, in one line — pure, so the
// wording is tested without a database (lib/characterStandingRead loads the facts).
//
// The profile listed characters and, separately, clans — and never said which character put you in
// which clan, or whether you were a member or only a guest. "Why can't I enter this event?" usually
// has its answer here: the character is a guest, or the clan's member list has not been synced since
// they joined in game.

import { parseStamp } from './dbTime.ts';

export interface StandingSeat {
  seatId: number;
  accountId: number;
  kind: 'member' | 'guest';
  clanId: number;
  clanName: string;
  clanSlug: string;
}

/** "just now", "12m ago", "3h ago", "5d ago" — or null when there is no readable stamp. */
export function syncAgo(stamp: string | null | undefined, nowMs: number): string | null {
  const ms = parseStamp(stamp);
  if (ms == null) return null;
  const mins = Math.max(0, Math.floor((nowMs - ms) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * One character's line. A member seat leads (OSRS allows one clan, so there is at most one), with
 * when that clan's in-game list last reached Anvil; guest seats follow; nothing at all says so.
 */
export function standingLine(
  seats: StandingSeat[],
  lastSyncByClan: Map<number, string | null>,
  nowMs: number,
): string {
  const member = seats.find((s) => s.kind === 'member');
  const guests = seats.filter((s) => s.kind === 'guest').map((s) => s.clanName);
  const parts: string[] = [];
  if (member) {
    const ago = syncAgo(lastSyncByClan.get(member.clanId) ?? null, nowMs);
    parts.push(`Member of ${member.clanName} · ${ago ? `list synced ${ago}` : 'list not synced yet'}`);
  }
  if (guests.length > 0) parts.push(`Guest in ${guests.join(', ')}`);
  if (parts.length === 0) return 'Not on any clan’s member list yet';
  return parts.join(' · ');
}
