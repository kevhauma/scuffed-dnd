ALTER TABLE `session` ADD `previous_token` text;--> statement-breakpoint
ALTER TABLE `session` ADD `previous_token_expires_at` integer;--> statement-breakpoint
CREATE INDEX `session_previous_token_idx` ON `session` (`previous_token`);