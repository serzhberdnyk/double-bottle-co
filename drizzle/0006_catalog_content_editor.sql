CREATE TABLE `catalog_editor_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`base_release_id` text NOT NULL,
	`base_generation` integer NOT NULL,
	`revision` integer NOT NULL,
	`status` text DEFAULT 'editing' NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`published_release_id` text,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`base_release_id`) REFERENCES `catalog_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_media_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`body_base64` text NOT NULL,
	`byte_length` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `catalog_release_products` ADD `description_edited` integer DEFAULT 0 NOT NULL;