import { and, asc, count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { playerGoals } from '@/db/schema';
import { checkGoal, MAX_GOALS, type GoalInput } from '@/lib/goalRules';
import { goalProgress, type GoalRates, type GoalRow, type GoalView } from '@/lib/goalProgress';
import { BOSSES, SKILLS } from '@/lib/constants';

// The one place goals are written — the plugin route and the profile page both come through here,
// so the cap and the "same goal again = new target" rule can't differ between them.

export function listGoals(accountId: number): Promise<GoalRow[]> {
  // clan-scope: global -- goals belong to an account, not a clan.
  return db
    .select({
      id: playerGoals.id,
      kind: playerGoals.kind,
      metric: playerGoals.metric,
      target: playerGoals.target,
      dueOn: playerGoals.dueOn,
    })
    .from(playerGoals)
    .where(eq(playerGoals.accountId, accountId))
    .orderBy(asc(playerGoals.id));
}

/** Add (or retarget) a goal. Returns the refusal as text, or null when it's saved. */
export async function saveGoal(accountId: number, input: GoalInput): Promise<string | null> {
  const goal = checkGoal(input);
  if (!goal.ok) return goal.error;
  // clan-scope: global -- goals belong to an account, not a clan.
  const existing = await db.query.playerGoals.findFirst({
    where: and(eq(playerGoals.accountId, accountId), eq(playerGoals.kind, goal.kind), eq(playerGoals.metric, goal.metric)),
    columns: { id: true },
  });
  if (existing) {
    // Same goal again = a new target (and deadline) for it, not a duplicate.
    await db.update(playerGoals).set({ target: goal.target, dueOn: goal.dueOn }).where(eq(playerGoals.id, existing.id));
    return null;
  }
  const [{ n }] = await db.select({ n: count() }).from(playerGoals).where(eq(playerGoals.accountId, accountId));
  if (n >= MAX_GOALS) return `Up to ${MAX_GOALS} goals — remove one first.`;
  await db
    .insert(playerGoals)
    .values({
      accountId,
      kind: goal.kind,
      metric: goal.metric,
      target: goal.target,
      dueOn: goal.dueOn,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  return null;
}

export async function deleteGoal(accountId: number, id: number): Promise<void> {
  // clan-scope: global -- scoped to the account by the WHERE.
  await db.delete(playerGoals).where(and(eq(playerGoals.id, id), eq(playerGoals.accountId, accountId)));
}

/** What a profile page's GoalsCard needs: the goals with progress, and what may be picked. */
export async function goalsForProfile(
  accountId: number,
  stats: { skills: { key: string; xp: number }[]; bosses: { key: string; kc: number }[] },
  pages: { name: string; obtained: number; total: number }[] | null,
  /** Recent gains per day (last 7 days ÷ 7), for "on pace" on a goal with a deadline. */
  rates?: GoalRates,
): Promise<{ goals: GoalView[]; options: { skills: string[]; bosses: { key: string; label: string }[]; pages: string[] } }> {
  const rows = await listGoals(accountId);
  const goals = rows.map((g) => goalProgress(g, { skills: stats.skills, bosses: stats.bosses, pages }, { rates }));
  return {
    goals,
    options: {
      skills: SKILLS.filter((s) => s !== 'overall'),
      bosses: [...BOSSES].map((b) => ({ key: b.key, label: b.label })).sort((a, b) => a.label.localeCompare(b.label)),
      pages: (pages ?? []).map((p) => p.name),
    },
  };
}
