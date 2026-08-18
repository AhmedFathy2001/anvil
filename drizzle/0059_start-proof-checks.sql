ALTER TABLE `event_start_proofs` ADD `x` integer;--> statement-breakpoint
ALTER TABLE `event_start_proofs` ADD `y` integer;--> statement-breakpoint
ALTER TABLE `event_start_proofs` ADD `distance` integer;--> statement-breakpoint
ALTER TABLE `event_start_proofs` ADD `position_ok` integer;--> statement-breakpoint
ALTER TABLE `event_start_proofs` ADD `login_at` text;--> statement-breakpoint
ALTER TABLE `event_start_proofs` ADD `session_minutes` integer;--> statement-breakpoint
ALTER TABLE `event_start_proofs` ADD `session_ok` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `start_proof_x` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `start_proof_y` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `start_proof_radius` integer;