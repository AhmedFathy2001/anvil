ALTER TABLE `moments` ADD `team_id` integer REFERENCES teams(id);
--> statement-breakpoint
-- Backfill the team every existing moment belonged to, from the roster as it stands. It's the best
-- answer available for history (nobody recorded it at the time) and it is exactly what the read-time
-- join was already showing — the difference is that from here on it stops moving when someone subs.
UPDATE `moments`
SET `team_id` = (
  SELECT `p`.`team_id` FROM `players` `p`
  WHERE `p`.`event_id` = `moments`.`event_id`
    AND `p`.`clan_member_id` = `moments`.`clan_member_id`
  LIMIT 1
)
WHERE `event_id` IS NOT NULL AND `team_id` IS NULL;
