CREATE TABLE `map_editor_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`published_revision` integer DEFAULT 0 NOT NULL,
	`draft_json` text,
	`published_json` text,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
