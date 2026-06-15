ALTER TABLE `events` ADD `scoring_mode` text DEFAULT 'tiles' NOT NULL;--> statement-breakpoint
ALTER TABLE `tiles` ADD `points` integer DEFAULT 1 NOT NULL;