CREATE TABLE `internal_supply_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`status` text NOT NULL,
	`priority` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`compatibility_json` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	FOREIGN KEY (`revision_id`) REFERENCES `catalog_variant_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `internal_supplier_offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bindings_revision` ON `internal_supply_bindings` (`revision_id`,`status`);--> statement-breakpoint
CREATE TABLE `catalog_destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`lat_micro` integer NOT NULL,
	`lng_micro` integer NOT NULL,
	`region` text NOT NULL,
	`description` text NOT NULL,
	`image` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_destinations_slug_unique` ON `catalog_destinations` (`slug`);--> statement-breakpoint
CREATE TABLE `internal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `internal_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`status` text NOT NULL,
	`source_json` text NOT NULL,
	`release_id` text,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `operations_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`contact_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_inquiry_idempotency` ON `operations_inquiries` (`owner_hash`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_inquiry_owner` ON `operations_inquiries` (`owner_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `catalog_media` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`license` text NOT NULL,
	`attribution` text NOT NULL,
	`source_url` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_media_path_unique` ON `catalog_media` (`path`);--> statement-breakpoint
CREATE TABLE `internal_supplier_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`source_id` text NOT NULL,
	`facts_json` text NOT NULL,
	`source_hash` text NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `internal_suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_offers_source` ON `internal_supplier_offers` (`supplier_id`,`source_id`);--> statement-breakpoint
CREATE TABLE `operations_order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`consent_ref` text NOT NULL,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `operations_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `operations_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiry_id` text NOT NULL,
	`kind` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`execution_json` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`inquiry_id`) REFERENCES `operations_inquiries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_products_slug_unique` ON `catalog_products` (`slug`);--> statement-breakpoint
CREATE TABLE `catalog_public_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`unit` text NOT NULL,
	`audience` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`conditions` text NOT NULL,
	`supplements_json` text NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `catalog_releases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `catalog_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_public_rates_release_variant` ON `catalog_public_rates` (`release_id`,`variant_id`,`valid_until`);--> statement-breakpoint
CREATE TABLE `catalog_redirects` (
	`from_slug` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_release_products` (
	`release_id` text NOT NULL,
	`product_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`image` text,
	`image_alt` text NOT NULL,
	`sale_status` text NOT NULL,
	`publication_status` text NOT NULL,
	`featured_rank` integer DEFAULT 999 NOT NULL,
	PRIMARY KEY(`release_id`, `product_id`),
	FOREIGN KEY (`release_id`) REFERENCES `catalog_releases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_release_products_category` ON `catalog_release_products` (`release_id`,`publication_status`,`category`);--> statement-breakpoint
CREATE TABLE `catalog_release_variants` (
	`release_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`sale_status` text NOT NULL,
	PRIMARY KEY(`release_id`, `variant_id`),
	FOREIGN KEY (`release_id`) REFERENCES `catalog_releases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `catalog_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `catalog_variant_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_release_variants_revision` ON `catalog_release_variants` (`release_id`,`revision_id`);--> statement-breakpoint
CREATE TABLE `catalog_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`status` text NOT NULL,
	`base_id` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`summary_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_releases_hash_unique` ON `catalog_releases` (`hash`);--> statement-breakpoint
CREATE TABLE `catalog_variant_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`hash` text NOT NULL,
	`name` text NOT NULL,
	`duration` text NOT NULL,
	`days` integer NOT NULL,
	`transport` text NOT NULL,
	`format` text NOT NULL,
	`terms_json` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `catalog_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`release_id` text,
	`generation` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `catalog_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_itinerary_stops` (
	`revision_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`visit_type` text NOT NULL,
	`required` integer NOT NULL,
	`note` text NOT NULL,
	PRIMARY KEY(`revision_id`, `sequence`),
	FOREIGN KEY (`revision_id`) REFERENCES `catalog_variant_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_id`) REFERENCES `catalog_destinations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_stops_destination_revision` ON `catalog_itinerary_stops` (`destination_id`,`revision_id`);--> statement-breakpoint
CREATE TABLE `internal_supplier_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`amount_minor` integer,
	`currency` text NOT NULL,
	`kind` text NOT NULL,
	`unit` text NOT NULL,
	`valid_from` text,
	`valid_until` text,
	`source_text` text NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `internal_supplier_offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `internal_suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`details_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operations_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_variants_product` ON `catalog_variants` (`product_id`);