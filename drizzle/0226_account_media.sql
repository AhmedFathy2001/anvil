-- A character's own avatar/banner, overriding the person's (profile_media) on that character only.
-- Numbered 0226: 0225 is reserved by feat/reach-out (0225_reach_out.sql).
CREATE TABLE IF NOT EXISTS "account_media" (
	"account_id" integer PRIMARY KEY NOT NULL,
	"avatar_url" text,
	"avatar_still_url" text,
	"banner_url" text,
	"banner_still_url" text,
	"banner_position" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_media_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action
);
