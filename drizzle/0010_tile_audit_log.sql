CREATE TABLE `tile_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`tile_id` integer,
	`tile_label` text,
	`action` text NOT NULL,
	`changed_fields` text,
	`old_value` text,
	`new_value` text,
	`actor_user_id` integer,
	`occurred_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tile_audit_log_event_id_idx` ON `tile_audit_log` (`event_id`);--> statement-breakpoint
CREATE INDEX `tile_audit_log_occurred_at_idx` ON `tile_audit_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `tile_audit_log_tile_id_idx` ON `tile_audit_log` (`tile_id`);