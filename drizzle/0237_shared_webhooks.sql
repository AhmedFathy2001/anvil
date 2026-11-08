-- Shared Discord webhooks (lib/sharedWebhooks). The same webhook id configured by more than one clan
-- is raised to platform staff (/staff/webhooks), who can block it platform-wide. Ids only: a webhook
-- id is a snowflake, not a secret; no token is ever stored here.
CREATE TABLE IF NOT EXISTS "blocked_webhooks" (
	"webhook_id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"blocked_by_user_id" integer,
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_webhooks_blocked_by_user_id_users_id_fk" FOREIGN KEY ("blocked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
CREATE TABLE IF NOT EXISTS "shared_webhooks" (
	"webhook_id" text PRIMARY KEY NOT NULL,
	"clan_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_user_id" integer,
	"decided_at" timestamp with time zone,
	CONSTRAINT "shared_webhooks_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "shared_webhooks_status_idx" ON "shared_webhooks" USING btree ("status");
