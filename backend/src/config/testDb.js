import pool from "./db.js";

async function testDatabaseConnection() {
    try {
        const result = await pool.query("SELECT NOW()");

        console.log("Database connection successful");
        console.log("PostgreSQL time:", result.rows[0].now);
    } catch (error) {
        console.error("Database connection failed:", error.message);
    } finally {
        await pool.end();
    }
}

testDatabaseConnection();