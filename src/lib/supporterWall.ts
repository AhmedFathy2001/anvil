// The public supporters wall on /supporter: everyone supporting Anvil right now, longest unbroken
// support first, grouped by tenure step (lib/supporterTiers TENURE_LADDER).
//
// Shown by default once someone subscribes; users.supporter_wall (Settings → Supporter) takes them
// off. A person appears ONCE, under one character that already wears their flair publicly
// (flairCharacterWhere: shared + verified), so the wall never ties a hidden character to anyone. A
// person with no such character is counted, not named.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, supporterSubscriptions, users } from '@/db/schema';
import { flairCharacterWhere, supporterState, type SupporterState } from '@/lib/supporter';
import { ttlMemo } from '@/lib/ttlMemo';
import type { SupporterLook } from '@/lib/supporterStyle';

export interface WallEntry extends SupporterLook {
  name: string;
}

export interface SupporterWall {
  /** Everyone supporting right now, named or not (opted out included: the total isn't a name). */
  total: number;
  /** Named entries, longest tenure first. */
  entries: WallEntry[];
}

async function loadWall(): Promise<SupporterWall> {
  const rows = await db
    .select({
      playerId: users.playerId,
      wall: users.supporterWall,
      userId: supporterSubscriptions.userId,
      tier: supporterSubscriptions.tier,
      status: supporterSubscriptions.status,
      currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
      startedAt: supporterSubscriptions.startedAt,
      tenureStartedAt: supporterSubscriptions.tenureStartedAt,
      endedAt: supporterSubscriptions.endedAt,
      recurrence: supporterSubscriptions.recurrence,
      style: users.supporterStyle,
    })
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId));

  // One person, several logins: their rows together, the same way every other read does.
  const byPerson = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.playerId != null ? `p${r.playerId}` : `u${r.userId}`;
    byPerson.set(key, [...(byPerson.get(key) ?? []), r]);
  }
  let total = 0;
  const shown = new Map<number, SupporterState>();
  for (const list of byPerson.values()) {
    const state = supporterState(list);
    if (!state) continue;
    total++;
    // Off the wall if ANY of their logins opted out: the cautious reading of a privacy choice.
    const pid = list[0].playerId;
    if (pid != null && list.every((r) => r.wall)) shown.set(pid, state);
  }
  // The opt-out is the PERSON's: any of their logins saying no takes them off, including a login
  // with no subscription row of its own (the read above only sees logins that pay).
  if (shown.size > 0) {
    const out = await db
      .select({ playerId: users.playerId })
      .from(users)
      .where(and(inArray(users.playerId, [...shown.keys()]), eq(users.supporterWall, false)));
    for (const o of out) if (o.playerId != null) shown.delete(o.playerId);
  }
  if (shown.size === 0) return { total, entries: [] };

  const chars = await db
    .select({ playerId: accounts.playerId, rsn: accounts.rsn, status: accounts.status, isPrimary: accounts.isPrimary })
    .from(accounts)
    .where(and(inArray(accounts.playerId, [...shown.keys()]), isNotNull(accounts.playerId), flairCharacterWhere()));
  // Their main when it's in good standing, else any active character, a banned/unranked one only as a
  // last resort; then by name, a stable pick so the wall doesn't shuffle.
  const rank = (c: (typeof chars)[number]) => (c.status === 'active' ? 2 : 0) + (c.isPrimary ? 1 : 0);
  const nameOf = new Map<number, string>();
  for (const c of chars.sort((a, b) => rank(b) - rank(a) || a.rsn.localeCompare(b.rsn))) if (!nameOf.has(c.playerId)) nameOf.set(c.playerId, c.rsn);

  const entries: WallEntry[] = [];
  for (const [pid, state] of shown) {
    const name = nameOf.get(pid);
    if (!name) continue;
    entries.push({ name, tier: state.tier.id, style: state.style, tenure: { id: state.tenure.id, months: state.tenureMonths } });
  }
  entries.sort((a, b) => (b.tenure?.months ?? 0) - (a.tenure?.months ?? 0) || a.name.localeCompare(b.name));
  return { total, entries };
}

/** The wall, cached a few minutes: it changes when someone subscribes, lapses or opts out. */
export function supporterWall(): Promise<SupporterWall> {
  return ttlMemo('supporter-wall', loadWall, 5 * 60_000);
}
