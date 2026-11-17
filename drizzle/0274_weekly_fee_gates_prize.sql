-- A competition with an entry fee: hold the prizes while anyone in a paying place still owes theirs
-- (lib/weeklyPrizeSettle). On by default; staff release it by marking the fee paid, waiving it, or
-- taking the person out.
ALTER TABLE "weekly_competitions" ADD COLUMN IF NOT EXISTS "fee_gates_prize" boolean DEFAULT true NOT NULL;
