DROP TABLE `federation_account_shares`;--> statement-breakpoint
DROP TABLE `federation_bans`;--> statement-breakpoint
DROP TABLE `federation_connections`;--> statement-breakpoint
DROP TABLE `federation_device_sessions`;--> statement-breakpoint
DROP TABLE `federation_jti`;--> statement-breakpoint
DROP TABLE `federation_tokens`;--> statement-breakpoint
ALTER TABLE `submissions` DROP COLUMN `federated_source`;--> statement-breakpoint
ALTER TABLE `submissions` DROP COLUMN `federated_proof_url`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `federation_linked_at`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `federation_broker_session`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `federation_synced_at`;