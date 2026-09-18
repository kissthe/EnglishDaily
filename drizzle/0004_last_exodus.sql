CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`student` text NOT NULL,
	`task` text NOT NULL,
	`section` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`task`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_annotations_selection` ON `annotations` (`student`,`task`,`section`,`start`,`end`);--> statement-breakpoint
CREATE INDEX `idx_annotations_task` ON `annotations` (`task`);