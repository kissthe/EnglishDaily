ALTER TABLE `submissions` ADD `feedback_updated` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `feedback_read` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `correction_status` text DEFAULT '' NOT NULL;