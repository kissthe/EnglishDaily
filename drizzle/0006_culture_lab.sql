CREATE TABLE `culture_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`material` text NOT NULL,
	`student` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`material`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_culture_progress_material_student` ON `culture_progress` (`material`,`student`);--> statement-breakpoint
CREATE INDEX `idx_culture_progress_student` ON `culture_progress` (`student`);
