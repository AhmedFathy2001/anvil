-- Authority moves from the user to the (clan, user) pair.
--
-- `users.role` was global, which with many clans on one deployment made every admin an admin of
-- EVERY clan. That is the change this migration exists for.
--
-- The generated version created the table and stopped there, which would have been worse than the
-- bug: every existing admin, moderator and treasurer would have silently lost access at deploy,
-- including whoever had to log in to fix it. The backfill below is the whole point.

CREATE TABLE "clan_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"clan_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"can_edit_tiles" boolean DEFAULT false NOT NULL,
	"editor_scope" text DEFAULT 'all' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "platform_role" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_staff" ADD CONSTRAINT "clan_staff_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_staff" ADD CONSTRAINT "clan_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clan_staff_clan_user_unique" ON "clan_staff" USING btree ("clan_id","user_id");--> statement-breakpoint
CREATE INDEX "clan_staff_user_idx" ON "clan_staff" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clan_staff_clan_role_idx" ON "clan_staff" USING btree ("clan_id","role");--> statement-breakpoint

-- Backfill: everyone who held a role held it in the genesis clan, because that is the only clan a
-- pre-migration database had. Guests and plain members are skipped — a `member` grant carries no
-- authority, so a row for every user would be noise that makes "who is staff here?" harder to read.
--
-- The legacy `editor` role predates canEditTiles and meant "member with global authoring"; it lands
-- as a member WITH the capability rather than inventing a tier for it.
INSERT INTO "clan_staff" ("clan_id", "user_id", "role", "can_edit_tiles", "editor_scope")
SELECT
  (SELECT MIN("id") FROM "clans"),
  u."id",
  CASE
    WHEN u."is_owner" THEN 'owner'
    WHEN u."role" = 'editor' THEN 'member'
    ELSE u."role"
  END,
  u."can_edit_tiles" OR u."role" IN ('editor', 'admin'),
  u."editor_scope"
FROM "users" u
WHERE EXISTS (SELECT 1 FROM "clans")
  AND (u."is_owner" OR u."role" <> 'member' OR u."can_edit_tiles");
