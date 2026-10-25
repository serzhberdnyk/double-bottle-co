CREATE TABLE `catalog_release_destinations` (
	`release_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`lat_micro` integer NOT NULL,
	`lng_micro` integer NOT NULL,
	`region` text NOT NULL,
	`description` text NOT NULL,
	`image` text,
	PRIMARY KEY(`release_id`, `destination_id`),
	FOREIGN KEY (`release_id`) REFERENCES `catalog_releases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_id`) REFERENCES `catalog_destinations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `catalog_release_products` ADD `slug` text DEFAULT '' NOT NULL;