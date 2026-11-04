-- Anvil Supporter perks: a person's own avatar and banner (animated for Champion+), and a display
-- case of their best drops (Supporter 4 / Champion 8 / Patron 12). See lib/profileMedia and
-- lib/displayCase.
--
-- Both are PERSONAL (the login, users.id), like the subscription. Neither is gated here: the tier is
-- checked on every read, so a lapsed Champion shows the still frame and a lapsed Supporter's case is
-- hidden with its rows kept, and nothing has to run when a membership ends.
--
-- Separate tables rather than columns on "users": whole user rows are read in many places, and four
-- URLs riding along on each of those reads would be weight for nothing.
CREATE TABLE IF NOT EXISTS "profile_media" (
	"user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	-- What the profile shows: animated WebP when the upload moved, else the same still.
	"avatar_url" text,
	-- Always a single frame (the first). What lists, reduced-motion viewers and a lapsed tier see.
	"avatar_still_url" text,
	"banner_url" text,
	"banner_still_url" text,
	-- Vertical focus of the banner when its frame crops it, 0 (top) - 100 (bottom); NULL = centred.
	"banner_position" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "display_case_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	-- Left to right. Only the first N (N = the tier's slots) show.
	"position" integer NOT NULL DEFAULT 0,
	-- 'clog' = an obtained collection-log slot (member_clog_items); 'drop' = a drop moment (moments).
	"kind" text NOT NULL,
	-- The character it was obtained on. Re-checked against the person on every read, so a character
	-- that leaves them takes its pins with it without a write.
	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"item_id" integer NOT NULL,
	"moment_id" integer REFERENCES "moments"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "display_case_items_user_idx" ON "display_case_items" ("user_id", "position");
-- One pin per collection-log slot per character, and one per drop.
CREATE UNIQUE INDEX IF NOT EXISTS "display_case_items_clog_unique" ON "display_case_items" ("user_id", "account_id", "item_id") WHERE "kind" = 'clog';
CREATE UNIQUE INDEX IF NOT EXISTS "display_case_items_drop_unique" ON "display_case_items" ("user_id", "moment_id") WHERE "kind" = 'drop';
