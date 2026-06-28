CREATE TABLE `pending_notifications` (
	`tile_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`pending_amount` integer DEFAULT 0 NOT NULL,
	`latest_total` integer,
	`required_amount` integer,
	`latest_image_url` text,
	`latest_note` text,
	`latest_credit_name` text,
	`completed` integer DEFAULT 0 NOT NULL,
	`first_queued_at` text NOT NULL,
	`last_event_at` text NOT NULL,
	PRIMARY KEY(`tile_id`, `team_id`),
	FOREIGN KEY (`tile_id`) REFERENCES `tiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pending_notifications_last_event_idx` ON `pending_notifications` (`last_event_at`);
