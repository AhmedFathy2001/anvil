import { eq, isNull, or } from 'drizzle-orm';
import { submissions } from '@/db/schema';
import { ALT_GOAL_KEY } from '@/lib/altGoal';

// SQL halves of lib/altGoal's one rule: a submission whose `goal` is set credits an either/or tile's
// ALTERNATIVE and never counts toward the tile's own (primary) requirement.

/** Rows that count toward the tile's own requirement — every SUM/MAX/MIN of a tile's progress. */
export const primaryCredit = () => isNull(submissions.goal);

/** Rows that are someone's WORK on the tile (who finished it): primary credits and the alternative's
 * own counter, never its cap counters (energy is not a turn-in). */
export const workCredit = () => or(isNull(submissions.goal), eq(submissions.goal, ALT_GOAL_KEY));
