import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, clans } from '@/db/schema';

export interface MyClan {
  id: number;
  slug: string;
  name: string;
  /** How they are attached to the roster: a seat of this kind, or none. */
  seat: 'member' | 'guest' | null;
  /** Whether they hold authority here, which is a separate thing from a seat. */
  staff: boolean;
  /**
   * WHICH authority, when they hold one — 'owner', 'admin', 'moderator', 'treasurer', 'editor'.
   *
   * `staff` alone could not answer "what am I here?", so the switcher fell back to the seat kind and
   * an owner with a roster seat was labelled "member" while the same person in a clan they had not
   * joined was labelled "staff" — two different words for the owner of two clans.
   */
  role: string | null;
}

/**
 * Every clan a person belongs to, by either of the two ways of belonging.
 *
 * The platform had no way to ask this, which is a strange gap for one whose whole premise is that
 * people are in more than one clan. Without it the header could not name your other clans and the
 * apex could not show you yours, so every clan read as a separate site you had wandered into — the
 * isolation was in the shell, not in the data.
 *
 * TWO AXES, deliberately unioned, and the reason this is two queries rather than one clever join.
 * A seat is roster membership; a grant is authority. They come apart routinely: a visiting clan's
 * moderator running a team holds a grant and no seat, and an admin who never joined their own
 * roster is common enough that filtering to seats alone would hide a clan from the person who runs
 * it. Written plainly because a join expressing "either of these, outer, deduplicated" is the kind
 * of query that looks right and quietly returns the wrong set.
 *
 * Ordered by name, so a switcher does not reshuffle between requests.
 */
export async function clansOfPerson(
  playerId: number | null | undefined,
  userId: number | null | undefined,
): Promise<MyClan[]> {
  const byId = new Map<number, MyClan>();

  if (playerId != null) {
    const seats = await db
      .select({ id: clans.id, slug: clans.slug, name: clans.name, kind: clanMemberships.kind })
      .from(clanMemberships)
      .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
      .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
      .where(and(eq(accounts.playerId, playerId), isNull(clanMemberships.leftAt)));

    for (const r of seats) {
      const seat = r.kind === 'member' ? 'member' : 'guest';
      const existing = byId.get(r.id);
      // One person can hold several accounts in the same clan. A member seat outranks a guest one.
      if (existing) {
        if (seat === 'member') existing.seat = 'member';
        continue;
      }
      byId.set(r.id, { id: r.id, slug: r.slug, name: r.name, seat, staff: false, role: null });
    }
  }

  if (userId != null) {
    const grants = await db
      .select({ id: clans.id, slug: clans.slug, name: clans.name, role: clanStaff.role })
      .from(clanStaff)
      .innerJoin(clans, eq(clans.id, clanStaff.clanId))
      .where(eq(clanStaff.userId, userId));

    for (const r of grants) {
      const existing = byId.get(r.id);
      if (existing) {
        existing.staff = true;
        existing.role = r.role;
      } else {
        byId.set(r.id, { id: r.id, slug: r.slug, name: r.name, seat: null, staff: true, role: r.role });
      }
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * How many OSRS accounts this person plays.
 *
 * The shell shows it under their name, which is the one place the person/account distinction is
 * worth stating outright: "Ahmed · 3 characters" says the thing a rail full of clans otherwise
 * implies badly. One indexed count, cheap enough to ask on every render.
 */
export async function characterCount(playerId: number | null | undefined): Promise<number> {
  if (playerId == null) return 0;
  // clan-scope: global -- a person's characters are theirs, not a clan's. That is the whole model.
  const [row] = await db.select({ n: count() }).from(accounts).where(eq(accounts.playerId, playerId));
  return Number(row?.n ?? 0);
}
