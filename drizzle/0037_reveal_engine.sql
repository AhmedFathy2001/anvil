ALTER TABLE `completions` ADD `awarded_points` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `rules` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `reveal_at` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `revealed_at` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `closed_at` text;