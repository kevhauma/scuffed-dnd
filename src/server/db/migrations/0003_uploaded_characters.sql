CREATE TABLE `account_upload_prompt` (
	`account_id` text PRIMARY KEY NOT NULL,
	`prompted_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_character` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`owner_account_id` text NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_character`("id", "session_id", "owner_account_id", "name", "revision", "data", "created_at", "updated_at") SELECT "id", "session_id", "owner_account_id", "name", "revision", "data", "created_at", "updated_at" FROM `character`;--> statement-breakpoint
DROP TABLE `character`;--> statement-breakpoint
ALTER TABLE `__new_character` RENAME TO `character`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `character_session_idx` ON `character` (`session_id`);--> statement-breakpoint
CREATE INDEX `character_owner_idx` ON `character` (`owner_account_id`);