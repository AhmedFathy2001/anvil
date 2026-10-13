-- Level / XP milestone rules (lib/levelRules). The clan's rules are a settings row (`level_rules`);
-- these are the person's side: their choice for clan channels and the rules for their own webhooks.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "level_posts_clan" text DEFAULT 'clan' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "level_rules" text;
