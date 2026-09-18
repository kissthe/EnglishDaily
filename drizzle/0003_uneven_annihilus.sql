CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`submission` text NOT NULL,
	`question` text NOT NULL,
	`state` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`submission`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_assessments_submission_question` ON `assessments` (`submission`,`question`);--> statement-breakpoint
CREATE TABLE `listens` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`student` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`extra` integer DEFAULT 0 NOT NULL,
	`token` text,
	`expires` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`task`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_listens_task_student` ON `listens` (`task`,`student`);