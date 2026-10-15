
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import pool from "../src/config/db.js";

const migrationsDirectory = join(import.meta.dirname, "migrations");

function calculateChecksum(content) {
  return createHash("sha256")
    .update(content)
    .digest("hex");
}

async function runMigrations() {
  let client;

  try {
    client = await pool.connect();

    console.log("Starting database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Upgrade existing migration metadata before processing files.
    await client.query(`
      ALTER TABLE schema_migrations
      ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);
    `);

    const files = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const filePath = join(migrationsDirectory, file);
      const sql = readFileSync(filePath, "utf8");

      const checksum = calculateChecksum(sql);

      const result = await client.query(
        `
          SELECT checksum
          FROM schema_migrations
          WHERE migration_name = $1
        `,
        [file]
      );

      if (result.rowCount > 0) {
        const storedChecksum = result.rows[0].checksum;

        if (storedChecksum && storedChecksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch: ${file}`
          );
        }

        if (!storedChecksum) {
          await client.query(
            `
              UPDATE schema_migrations
              SET checksum = $1
              WHERE migration_name = $2
            `,
            [checksum, file]
          );
        }

        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`Applying ${file}...`);

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          `
            INSERT INTO schema_migrations (
              migration_name,
              checksum
            )
            VALUES ($1, $2)
          `,
          [file, checksum]
        );

        await client.query("COMMIT");

        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    await client.query(`
      ALTER TABLE schema_migrations
      ALTER COLUMN checksum SET NOT NULL;
    `);

    console.log("Database migrations completed.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }

    await pool.end();
  }
}

runMigrations();
