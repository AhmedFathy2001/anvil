-- gp totals past 2,147,483,647. int4 overflowed on an event's cumulative loot (and a rare single haul),
-- and the plugin endpoints accept up to a trillion, so the write failed instead of storing it.
ALTER TABLE "event_participants" ALTER COLUMN "loot_gp_gained" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "player_event_facts" ALTER COLUMN "loot_gp_gained" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "moments" ALTER COLUMN "value_gp" TYPE bigint;
