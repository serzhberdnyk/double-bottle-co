CREATE TABLE `operations_favorites` (
	`owner_hash` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_hash`, `product_id`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE no action
);
