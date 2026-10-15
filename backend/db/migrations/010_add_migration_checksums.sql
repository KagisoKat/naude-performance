
ALTER TABLE schema_migrations
ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);
