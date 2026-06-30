import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

// MEMBER_CAP is injected per clan by the control-plane provisioner from the plan tier
// (0 / unset = unlimited). It bounds the *billable active roster*: members that are active,
// present (not soft-left), and not guests.
export function memberCap(): number | null {
  const raw = Number(process.env.MEMBER_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : null; // null = unlimited
}

/** Count of the billable active roster. */
export async function activeMemberCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(clanMembers)
    .where(
      and(eq(clanMembers.status, 'active'), isNull(clanMembers.leftAt), eq(clanMembers.isGuest, 0)),
    );
  return Number(row?.n ?? 0);
}

export interface CapStatus {
  cap: number | null; // null = unlimited
  active: number;
  overLimit: boolean;
  remaining: number | null; // null = unlimited
}

export async function rosterCapStatus(): Promise<CapStatus> {
  const cap = memberCap();
  const active = await activeMemberCount();
  return {
    cap,
    active,
    overLimit: cap != null && active > cap,
    remaining: cap != null ? Math.max(0, cap - active) : null,
  };
}
