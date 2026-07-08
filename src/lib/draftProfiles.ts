import { db } from '@/db';
import { eventSignups } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseProfile, type SignupProfile } from './signup';

// Frozen sign-up answers, keyed by the RSN (clanMemberId) the member chose to play with.
// Draft surfaces join their `players` rows against this so captains/admins can read the
// form answers (hours, bosses, skills, notes, timezone) right where they draft — instead
// of only on the Sign-ups / Applicants pages. Read-time join keeps `eventSignups` the
// single source of truth (edits before the deadline show through, no denormalized copy).
//
// A clan member has at most one active sign-up per event, but withdrawn/rejected rows can
// coexist with a later re-join — prefer a non-terminal answer so a stale withdrawal never
// masks the real one.
const TERMINAL_STATUSES = new Set(['withdrawn', 'rejected']);

export async function loadEventProfiles(eventId: number): Promise<Map<number, SignupProfile>> {
  const rows = await db
    .select({
      clanMemberId: eventSignups.clanMemberId,
      profileData: eventSignups.profileData,
      status: eventSignups.status,
    })
    .from(eventSignups)
    .where(eq(eventSignups.eventId, eventId));

  const map = new Map<number, SignupProfile>();
  const storedIsTerminal = new Map<number, boolean>();
  for (const row of rows) {
    const isTerminal = TERMINAL_STATUSES.has(row.status);
    const canOverwrite = !map.has(row.clanMemberId)
      // Only a terminal answer may be replaced — by a non-terminal one.
      || (storedIsTerminal.get(row.clanMemberId) === true && !isTerminal);
    if (!canOverwrite) continue;
    map.set(row.clanMemberId, parseProfile(row.profileData));
    storedIsTerminal.set(row.clanMemberId, isTerminal);
  }
  return map;
}

// Attach the matching frozen profile to each player row (null when unlinked / no sign-up).
export function attachProfiles<T extends { clanMemberId: number | null }>(
  players: T[],
  profiles: Map<number, SignupProfile>,
): (T & { profile: SignupProfile | null })[] {
  return players.map((p) => ({
    ...p,
    profile: p.clanMemberId != null ? profiles.get(p.clanMemberId) ?? null : null,
  }));
}
