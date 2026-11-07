-- Gumroad sales the webhook could not attach to anything, kept for staff (/staff/subscriptions).
-- Before this a clan/creator sale with no checkout ref, a cross-catalogue product bought through a
-- clan's checkout, or a Supporter sale with no buyer ref was only console.warn'd, and container logs
-- go with every blue-green deploy. One row per sale (unique sale id: a webhook retry is a no-op);
-- later notifications for the same subscription update gumroad_state on the open row.
-- Numbered 0228: 0225 is reserved by feat/reach-out (0225_reach_out.sql).
CREATE TABLE IF NOT EXISTS "unmatched_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"gumroad_sale_id" text,
	"gumroad_subscription_id" text,
	"product_id" text,
	"product_name" text,
	"product_permalink" text,
	"tier" text,
	"plan_id" text,
	"recurrence" text,
	"price_cents" integer,
	"currency" text,
	"buyer_email" text,
	"ref" text,
	"url_params" jsonb,
	"free_trial_ends_at" text,
	"sale_timestamp" text,
	"ref_clan_id" integer,
	"gumroad_state" text DEFAULT 'sold' NOT NULL,
	"last_event_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" integer,
	"resolution_note" text,
	"attached_clan_id" integer,
	"attached_user_id" integer,
	CONSTRAINT "unmatched_purchases_ref_clan_id_clans_id_fk" FOREIGN KEY ("ref_clan_id") REFERENCES "public"."clans"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "unmatched_purchases_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "unmatched_purchases_attached_clan_id_clans_id_fk" FOREIGN KEY ("attached_clan_id") REFERENCES "public"."clans"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "unmatched_purchases_attached_user_id_users_id_fk" FOREIGN KEY ("attached_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "unmatched_purchases_kind_check" CHECK ("kind" IN ('plan', 'creator', 'supporter')),
	CONSTRAINT "unmatched_purchases_reason_check" CHECK ("reason" IN ('no-ref', 'cross-catalogue', 'no-buyer')),
	CONSTRAINT "unmatched_purchases_status_check" CHECK ("status" IN ('open', 'attached', 'dismissed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "unmatched_purchases_sale_unique" ON "unmatched_purchases" USING btree ("gumroad_sale_id");
CREATE INDEX IF NOT EXISTS "unmatched_purchases_subscription_idx" ON "unmatched_purchases" USING btree ("gumroad_subscription_id");
CREATE INDEX IF NOT EXISTS "unmatched_purchases_status_idx" ON "unmatched_purchases" USING btree ("status", "received_at");
