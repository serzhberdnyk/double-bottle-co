CREATE TRIGGER immutable_variant_revision BEFORE UPDATE ON catalog_variant_revisions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_itinerary BEFORE UPDATE ON catalog_itinerary_stops BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ITINERARY'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_inquiry_snapshot BEFORE UPDATE OF snapshot_json ON operations_inquiries BEGIN SELECT RAISE(ABORT,'IMMUTABLE_SNAPSHOT'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_order_snapshot BEFORE UPDATE ON operations_orders BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ORDER'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_order_event BEFORE UPDATE ON operations_order_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ORDER_EVENT'); END;
