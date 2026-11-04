-- SPACE PAGES (lib/spacePage): a creator space's promotional content — bio, "About" panels, a weekly
-- schedule and a featured clip — plus the brand guardrail behind it: a staff-edited domain blocklist
-- and a report queue. Keyed by clan id so a Streaming clan could opt in later. Additive and safe to
-- run twice. The logo and banner stay on "clans".

CREATE TABLE IF NOT EXISTS "space_profiles" (
  "clan_id" integer PRIMARY KEY NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "bio" text,
  "schedule_tz" text,
  "featured_highlight_id" integer REFERENCES "stream_highlights"("id") ON DELETE SET NULL,
  "featured_clip_url" text,
  "featured_title" text,
  -- Platform staff hid the whole page's promotional content.
  "hidden_at" timestamp with time zone,
  "hidden_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "space_panels" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "position" integer DEFAULT 0 NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "image_url" text,
  "link_url" text,
  "hidden" boolean DEFAULT false NOT NULL,
  "staff_hidden_at" timestamp with time zone,
  "staff_hidden_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_panels_clan_idx" ON "space_panels" USING btree ("clan_id","position");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "space_schedule_slots" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  -- 0 = Sunday … 6 = Saturday, and minutes past midnight, both in space_profiles.schedule_tz.
  "weekday" smallint NOT NULL,
  "minute_of_day" integer NOT NULL,
  "label" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_schedule_slots_clan_idx" ON "space_schedule_slots" USING btree ("clan_id");--> statement-breakpoint

-- What a space page may not link to: a domain and every subdomain. Seeded below; staff edit it at
-- /staff/promotions.
CREATE TABLE IF NOT EXISTS "promo_blocked_domains" (
  "id" serial PRIMARY KEY NOT NULL,
  "domain" text NOT NULL,
  "reason" text DEFAULT 'other' NOT NULL,
  "added_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "promo_blocked_domains_domain" ON "promo_blocked_domains" USING btree ("domain");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "promo_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "clan_id" integer NOT NULL REFERENCES "clans"("id") ON DELETE CASCADE,
  "panel_id" integer REFERENCES "space_panels"("id") ON DELETE SET NULL,
  "reporter_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "reason" text,
  "snapshot" text DEFAULT '' NOT NULL,
  -- 'open' | 'hidden' | 'dismissed'
  "status" text DEFAULT 'open' NOT NULL,
  "resolved_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promo_reports_status_idx" ON "promo_reports" USING btree ("status","created_at");--> statement-breakpoint

-- The seed (lib/spacePage/blocklistSeed.ts, kept equal by tests/creator-panels.test.ts).
INSERT INTO "promo_blocked_domains" ("domain", "reason") VALUES
  ('playerauctions.com', 'rwt'),
  ('g2g.com', 'rwt'),
  ('eldorado.gg', 'rwt'),
  ('probemas.com', 'rwt'),
  ('sythe.org', 'rwt'),
  ('epicnpc.com', 'rwt'),
  ('ownedcore.com', 'rwt'),
  ('elitepvpers.com', 'rwt'),
  ('rsorder.com', 'rwt'),
  ('mmogah.com', 'rwt'),
  ('igvault.com', 'rwt'),
  ('rpgstash.com', 'rwt'),
  ('chicksgold.com', 'rwt'),
  ('lootbar.gg', 'rwt'),
  ('u7buy.com', 'rwt'),
  ('mmoga.com', 'rwt'),
  ('z2u.com', 'rwt'),
  ('gameflip.com', 'rwt'),
  ('accsmarket.com', 'rwt'),
  ('virtgold.com', 'rwt'),
  ('goldah.com', 'rwt'),
  ('mulefactory.com', 'rwt'),
  ('aoeah.com', 'rwt'),
  ('skycoach.gg', 'boosting'),
  ('overgear.com', 'boosting'),
  ('dreambot.org', 'bots'),
  ('tribot.org', 'bots'),
  ('osbot.org', 'bots'),
  ('powerbot.org', 'bots'),
  ('runemate.com', 'bots'),
  ('epicbot.com', 'bots'),
  ('rspeer.org', 'bots'),
  ('villavu.com', 'bots'),
  ('openosrs.com', 'bots'),
  ('rune-server.ee', 'rsps'),
  ('rune-server.org', 'rsps'),
  ('moparscape.org', 'rsps'),
  ('runelocus.com', 'rsps'),
  ('rsps-list.com', 'rsps'),
  ('top100arena.com', 'rsps'),
  ('topg.org', 'rsps'),
  ('alora.io', 'rsps'),
  ('roatpkz.com', 'rsps'),
  ('stake.com', 'gambling'),
  ('stake.us', 'gambling'),
  ('roobet.com', 'gambling'),
  ('rollbit.com', 'gambling'),
  ('duelbits.com', 'gambling'),
  ('gamdom.com', 'gambling'),
  ('bc.game', 'gambling'),
  ('shuffle.com', 'gambling'),
  ('runewager.com', 'gambling'),
  ('csgoroll.com', 'gambling'),
  ('csgoempire.com', 'gambling'),
  ('thunderpick.io', 'gambling'),
  ('bit.ly', 'shortener'),
  ('bitly.com', 'shortener'),
  ('tinyurl.com', 'shortener'),
  ('t.co', 'shortener'),
  ('goo.gl', 'shortener'),
  ('ow.ly', 'shortener'),
  ('is.gd', 'shortener'),
  ('v.gd', 'shortener'),
  ('buff.ly', 'shortener'),
  ('cutt.ly', 'shortener'),
  ('rebrand.ly', 'shortener'),
  ('shorturl.at', 'shortener'),
  ('rb.gy', 'shortener'),
  ('tiny.cc', 'shortener'),
  ('s.id', 'shortener'),
  ('t.ly', 'shortener'),
  ('bl.ink', 'shortener'),
  ('short.io', 'shortener'),
  ('shorte.st', 'shortener'),
  ('adf.ly', 'shortener'),
  ('lnkd.in', 'shortener'),
  ('tr.ee', 'shortener'),
  ('linktr.ee', 'shortener'),
  ('beacons.ai', 'shortener'),
  ('lnk.bio', 'shortener'),
  ('snip.ly', 'shortener'),
  ('qr.ae', 'shortener'),
  ('urlz.fr', 'shortener'),
  ('clck.ru', 'shortener')
ON CONFLICT ("domain") DO NOTHING;
