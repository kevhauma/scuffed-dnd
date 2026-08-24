CREATE TABLE `character` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`owner_account_id` text NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_session_idx` ON `character` (`session_id`);--> statement-breakpoint
CREATE INDEX `character_owner_idx` ON `character` (`owner_account_id`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`actor_account_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_session_seq_unique` ON `event` (`session_id`,`seq`);--> statement-breakpoint
CREATE TABLE `game_session` (
	`id` text PRIMARY KEY NOT NULL,
	`ruleset_id` text,
	`dm_account_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`snapshot` text NOT NULL,
	`snapshot_schema_version` integer NOT NULL,
	`snapshot_taken_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`ruleset_id`) REFERENCES `ruleset`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `game_session_dm_idx` ON `game_session` (`dm_account_id`);--> statement-breakpoint
CREATE INDEX `game_session_ruleset_idx` ON `game_session` (`ruleset_id`);--> statement-breakpoint
CREATE TABLE `ruleset` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_account_id` text NOT NULL,
	`name` text NOT NULL,
	`schema_version` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ruleset_owner_idx` ON `ruleset` (`owner_account_id`);--> statement-breakpoint
CREATE TABLE `session_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`code` text NOT NULL,
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
CREATE UNIQUE INDEX `session_invite_code_unique` ON `session_invite` (`code`);--> statement-breakpoint
CREATE INDEX `session_invite_email_idx` ON `session_invite` (`email`);--> statement-breakpoint
CREATE INDEX `session_invite_session_idx` ON `session_invite` (`session_id`);--> statement-breakpoint
CREATE TABLE `session_member` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`account_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_member_unique` ON `session_member` (`session_id`,`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_member_one_dm` ON `session_member` (`session_id`) WHERE "session_member"."role" = 'dm';--> statement-breakpoint
CREATE INDEX `session_member_account_idx` ON `session_member` (`account_id`);