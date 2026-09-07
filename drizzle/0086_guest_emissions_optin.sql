ALTER TABLE "users" ALTER COLUMN "block_guest_emissions" SET DEFAULT false;--> statement-breakpoint
-- One-time reset so "opt in by default" applies to the current roster, not just new logins. Safe:
-- guest social emissions never actually fired under the old quiet default, so no existing value was
-- a functioning mute. A member who wants quiet re-enables their per-profile toggle (now meaningful).
UPDATE "users" SET "block_guest_emissions" = false;
