CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`student` text NOT NULL,
	`answers` text NOT NULL,
	`state` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`feedback` text NOT NULL,
	`grades` text NOT NULL,
	`corrections` text NOT NULL,
	`submitted` text,
	`updated` text NOT NULL,
	FOREIGN KEY (`task`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_task_student` ON `submissions` (`task`,`student`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`material` text NOT NULL,
	`note` text NOT NULL,
	`created` text NOT NULL
);
