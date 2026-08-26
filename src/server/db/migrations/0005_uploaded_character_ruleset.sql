ALTER TABLE `character` ADD `ruleset_id` text REFERENCES `ruleset`(`id`) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `character_ruleset_idx` ON `character` (`ruleset_id`);--> statement-breakpoint
UPDATE `character` SET `ruleset_id` = (
	SELECT `ruleset`.`id` FROM `ruleset`
	WHERE `ruleset`.`id` = json_extract(`character`.`data`, '$.configurationId')
) WHERE `session_id` IS NULL;
