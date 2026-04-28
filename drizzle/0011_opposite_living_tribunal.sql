ALTER TABLE `submissions` ADD `item_id` integer;--> statement-breakpoint
ALTER TABLE `tiles` ADD `tracked_item_ids` text;--> statement-breakpoint
ALTER TABLE `tiles` ADD `item_requirements` text;