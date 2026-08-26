PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`code` text,
	`email` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`declined_at` integer,
	`redeemed_at` integer,
	`redeemed_by_account_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_session_invite`("id", "session_id", "code", "email", "expires_at", "revoked_at", "declined_at", "redeemed_at", "redeemed_by_account_id", "created_at") SELECT "id", "session_id", "code", "email", "expires_at", "revoked_at", "declined_at", "redeemed_at", "redeemed_by_account_id", "created_at" FROM `session_invite`;--> statement-breakpoint
DROP TABLE `session_invite`;--> statement-breakpoint
ALTER TABLE `__new_session_invite` RENAME TO `session_invite`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_invite_code_unique` ON `session_invite` (`code`);--> statement-breakpoint
CREATE INDEX `session_invite_email_idx` ON `session_invite` (`email`);--> statement-breakpoint
CREATE INDEX `session_invite_session_idx` ON `session_invite` (`session_id`);