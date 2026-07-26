CREATE TABLE `survey_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`prompt` text NOT NULL,
	`options` text,
	`required` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `survey_questions_event_id_idx` ON `survey_questions` (`event_id`);--> statement-breakpoint
CREATE TABLE `survey_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer,
	`answers` text NOT NULL,
	`submitted_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `survey_responses_event_user_unique` ON `survey_responses` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `survey_responses_event_id_idx` ON `survey_responses` (`event_id`);