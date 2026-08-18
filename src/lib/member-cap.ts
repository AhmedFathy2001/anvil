import { db } from '@/db';
import { getSettingText, setSetting, deleteSetting } from '@/lib/settings';
import { clanMembers, clans } from '@/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { statusFrom, type CapStatus } from '@/lib/memberCapRules';

// Re-exported so callers keep importing everything cap-related from one place.
export {
  CAP_GRACE_DAYS,
  CAP_NEAR_WINDOW,
  capMessage,
  newMemberAllowance,
  statusFrom,
  type CapState,
  type CapStatus,
} from '@/lib/memberCapRules';

// The cap lives on the clan row now rather than in a MEMBER_CAP env var, because one deployment
// serves every clan and an env var can only describe one of them. Null = unlimited.
//
// It bounds the *billable active roster*: members that are active, present (not soft-left), and not
// guests.
async function memberCap(clanId: number): Promise<number | null> {
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  const cap = row?.memberCap;
  return typeof cap === 'number' && cap > 0 ? cap : null;
}

/** When the clan first went over its cap. Cleared the moment it drops back under. */
const CAP_OVER_SINCE_KEY = 'member_cap_over_since';

/** Count of the billable active roster. Guests are free and never counted. */
export async function activeMemberCount(clanId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.clanId, clanId),
        eq(clanMembers.status, 'active'),
        isNull(clanMembers.leftAt),
        eq(clanMembers.isGuest, 0),
      ),
    );
  return Number(row?.n ?? 0);
}

async function readOverSince(clanId: number): Promise<string | null> {
  const value = await getSettingText(clanId, CAP_OVER_SINCE_KEY);
  if (!value) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

async function writeOverSince(clanId: number, value: string | null): Promise<void> {
  // Deleted, not set to null: absence is what "not over the cap" means here.
  if (value == null) {
    await deleteSetting(clanId, CAP_OVER_SINCE_KEY);
    return;
  }
  await setSetting(clanId, CAP_OVER_SINCE_KEY, value);
}

/** Read-only view — for banners, dashboards, anything that shouldn't start a grace clock. */
export async function rosterCapStatus(clanId: number): Promise<CapStatus> {
  const cap = await memberCap(clanId);
  const [active, overSince] = await Promise.all([
    activeMemberCount(clanId),
    cap == null ? Promise.resolve(null) : readOverSince(clanId),
  ]);
  return statusFrom(cap, active, overSince, new Date());
}

/**
 * As {@link rosterCapStatus}, but also maintains the grace clock: starts it the first time a clan is
 * seen over its cap, and clears it the moment they're back under (so trimming the roster genuinely
 * resets the window rather than leaving a spent one behind).
 *
 * Call from the roster sync — the one place that observes the roster changing size.
 */
export async function syncCapGrace(clanId: number): Promise<CapStatus> {
  const cap = await memberCap(clanId);
  if (cap == null) return statusFrom(null, await activeMemberCount(clanId), null, new Date());

  const [active, storedSince] = await Promise.all([activeMemberCount(clanId), readOverSince(clanId)]);
  const status = statusFrom(cap, active, storedSince, new Date());

  if (status.overLimit && storedSince == null) {
    await writeOverSince(clanId, status.overSince!).catch(() => {});
  } else if (!status.overLimit && storedSince != null) {
    await writeOverSince(clanId, null).catch(() => {});
  }
  return status;
}
