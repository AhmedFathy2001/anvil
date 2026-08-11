import { db } from '@/db';
import { clanMembers, settings } from '@/db/schema';
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

// MEMBER_CAP is injected per clan by the control-plane provisioner from the plan tier
// (0 / unset = unlimited). It bounds the *billable active roster*: members that are active,
// present (not soft-left), and not guests.
export function memberCap(): number | null {
  const raw = Number(process.env.MEMBER_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : null; // null = unlimited
}

/** When the clan first went over its cap. Cleared the moment it drops back under. */
const CAP_OVER_SINCE_KEY = 'member_cap_over_since';

/** Count of the billable active roster. Guests are free and never counted. */
export async function activeMemberCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(clanMembers)
    .where(
      and(eq(clanMembers.status, 'active'), isNull(clanMembers.leftAt), eq(clanMembers.isGuest, 0)),
    );
  return Number(row?.n ?? 0);
}

async function readOverSince(): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, CAP_OVER_SINCE_KEY) });
  const value = row?.value?.trim();
  if (!value) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

async function writeOverSince(value: string | null): Promise<void> {
  if (value == null) {
    await db.delete(settings).where(eq(settings.key, CAP_OVER_SINCE_KEY));
    return;
  }
  await db
    .insert(settings)
    .values({ key: CAP_OVER_SINCE_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Read-only view — for banners, dashboards, anything that shouldn't start a grace clock. */
export async function rosterCapStatus(): Promise<CapStatus> {
  const cap = memberCap();
  const [active, overSince] = await Promise.all([activeMemberCount(), cap == null ? Promise.resolve(null) : readOverSince()]);
  return statusFrom(cap, active, overSince, new Date());
}

/**
 * As {@link rosterCapStatus}, but also maintains the grace clock: starts it the first time a clan is
 * seen over its cap, and clears it the moment they're back under (so trimming the roster genuinely
 * resets the window rather than leaving a spent one behind).
 *
 * Call from the roster sync — the one place that observes the roster changing size.
 */
export async function syncCapGrace(): Promise<CapStatus> {
  const cap = memberCap();
  if (cap == null) return statusFrom(null, await activeMemberCount(), null, new Date());

  const [active, storedSince] = await Promise.all([activeMemberCount(), readOverSince()]);
  const status = statusFrom(cap, active, storedSince, new Date());

  if (status.overLimit && storedSince == null) {
    await writeOverSince(status.overSince!).catch(() => {});
  } else if (!status.overLimit && storedSince != null) {
    await writeOverSince(null).catch(() => {});
  }
  return status;
}
