CREATE TABLE `catalog_creation_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`slug` text NOT NULL,
	`base_release_id` text NOT NULL,
	`base_generation` integer NOT NULL,
	`revision` integer NOT NULL,
	`status` text DEFAULT 'editing' NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`published_release_id` text,
	`published_generation` integer,
	FOREIGN KEY (`base_release_id`) REFERENCES `catalog_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_creation_drafts_product_id_unique` ON `catalog_creation_drafts` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_creation_drafts_slug_unique` ON `catalog_creation_drafts` (`slug`);