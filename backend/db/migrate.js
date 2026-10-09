
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pool from "../src/config/db.js";

// ES Modules replacement for __dirname
const migrationsDirectory = join(
  import.meta.dirname,
  "migrations"
);

async function runMigrations() {
  let client;

  try {
    // Obtain a dedicated PostgreSQL connection
    client = await pool.connect();

    console.log("Starting database migrations...");

    // Track which migrations have already been applied
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Read SQL migration files in alphabetical order
    const files = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      // Check whether this migration has already run
      const result = await client.query(
        `
          SELECT migration_name
          FROM schema_migrations
          WHERE migration_name = $1
        `,
        [file]
      );

      if (result.rowCount > 0) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      // Read the migration SQL
      const filePath = join(migrationsDirectory, file);
      const sql = readFileSync(filePath, "utf8");

      console.log(`Applying ${file}...`);

      // Start a database transaction
      await client.query("BEGIN");

      try {
        // Execute the SQL migration
        await client.query(sql);

        // Record the successful migration
        await client.query(
          `
            INSERT INTO schema_migrations (migration_name)
            VALUES ($1)
          `,
          [file]
        );

        // Save all changes
        await client.query("COMMIT");

        console.log(`Applied ${file}`);
      } catch (error) {
        // Undo changes if migration fails
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Database migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    // Release the dedicated connection
    if (client) {
      client.release();
    }

    // Close the PostgreSQL connection pool
    await pool.end();
  }
}

runMigrations();
