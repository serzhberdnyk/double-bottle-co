DROP INDEX `idx_offers_source`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_offers_source_version` ON `internal_supplier_offers` (`supplier_id`,`source_id`,`source_hash`);