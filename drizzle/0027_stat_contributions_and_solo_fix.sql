ALTER TABLE `completions` ADD `stat_contributions` text;
--> statement-breakpoint
UPDATE `tiles` SET `tracking_mode` = 'individual' WHERE `tracking_mode` = 'solo';