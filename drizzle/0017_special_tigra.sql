CREATE TABLE `federation_jti` (
	`jti` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `federation_jti_expires_at_idx` ON `federation_jti` (`expires_at`);