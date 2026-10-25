-- Additive, schema-only migration: historical rows intentionally remain NULL.
-- Effective ownership is COALESCE(release owner, immutable variant origin).
-- Application writes set owners explicitly; cloning preserves raw legacy NULLs.
ALTER TABLE `catalog_release_variants` ADD `product_id` text REFERENCES `catalog_products`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_release_variant_owner` ON `catalog_release_variants` (`release_id`,`product_id`);
