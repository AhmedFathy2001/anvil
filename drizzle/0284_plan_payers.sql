-- Delegated plan payer (lib/planPayers): the owner lets an admin, treasurer or moderator pay for the
-- clan's plan, and the clan records who started the membership that pays for it (display, notices).
ALTER TABLE "clan_staff" ADD COLUMN IF NOT EXISTS "can_pay_plan" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN IF NOT EXISTS "plan_paid_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
