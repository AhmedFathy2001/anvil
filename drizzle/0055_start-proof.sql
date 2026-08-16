CREATE TABLE `event_start_proofs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`team_id` integer,
	`rsn` text,
	`image_url` text NOT NULL,
	`source` text NOT NULL,
	`keyword` text,
	`keyword_ok` integer DEFAULT false NOT NULL,
	`captured_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_by` integer,
	`reviewed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_start_proof_player_unique` ON `event_start_proofs` (`event_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `event_start_proof_event_status_idx` ON `event_start_proofs` (`event_id`,`status`);--> statement-breakpoint
ALTER TABLE `events` ADD `start_proof_location` text;--> statement-breakpoint
ALTER TABLE `events` ADD `start_proof_drawn_at` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `flagged_reason` text;