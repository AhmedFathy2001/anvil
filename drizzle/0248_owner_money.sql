-- Owner money page: a ledger of Gumroad money events (written by the webhook from now on) and the
-- owner's trial grants. See lib/moneyLedger and lib/ownerTrials.
CREATE TABLE "billing_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"product" text NOT NULL,
	"tier" text,
	"sale_id" text,
	"subscription_id" text,
	"amount_cents" integer,
	"fee_cents" integer,
	"currency" text,
	"recurrence" text,
	"partial" boolean DEFAULT false NOT NULL,
	"buyer_email" text
);
--> statement-breakpoint
CREATE TABLE "owner_trials" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"user_id" integer,
	"clan_id" integer,
	"tier" text NOT NULL,
	"days" integer NOT NULL,
	"note" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"entitlement_id" integer,
	"granted_by" integer,
	"revoked_at" timestamp with time zone,
	"revoked_by" integer,
	"converted_at" timestamp with time zone,
	CONSTRAINT "owner_trials_one_target" CHECK (("owner_trials"."user_id" is null) <> ("owner_trials"."clan_id" is null))
);
--> statement-breakpoint
ALTER TABLE "owner_trials" ADD CONSTRAINT "owner_trials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_trials" ADD CONSTRAINT "owner_trials_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_trials" ADD CONSTRAINT "owner_trials_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_trials" ADD CONSTRAINT "owner_trials_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_ledger_sale_kind_unique" ON "billing_ledger" USING btree ("sale_id","kind");--> statement-breakpoint
CREATE INDEX "billing_ledger_occurred_idx" ON "billing_ledger" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "billing_ledger_sub_idx" ON "billing_ledger" USING btree ("subscription_id","occurred_at");--> statement-breakpoint
CREATE INDEX "owner_trials_ends_idx" ON "owner_trials" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "owner_trials_user_idx" ON "owner_trials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "owner_trials_clan_idx" ON "owner_trials" USING btree ("clan_id");
