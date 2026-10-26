
import assert from "node:assert/strict";
import pool from "../src/config/db.js";
describe("NAUDÉ database constraints", function () {
  let client;

  before(async function () {
    client = await pool.connect();
  });

  after(async function () {
    client.release();
    await pool.end();
  });

  beforeEach(async function () {
    await client.query("BEGIN");
  });

  afterEach(async function () {
    await client.query("ROLLBACK");
  });

  it("rejects duplicate emails regardless of case", async function () {
    await client.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        "Test",
        "User",
        "database-test@naude.local",
        "fake_hash"
      ]
    );

    await assert.rejects(
      client.query(
        `
          INSERT INTO users (
            first_name,
            last_name,
            email,
            password_hash
          )
          VALUES ($1, $2, $3, $4)
        `,
        [
          "Another",
          "User",
          "DATABASE-TEST@NAUDE.LOCAL",
          "fake_hash"
        ]
      ),
      (error) => error.code === "23505"
    );
  });

  it("rejects negative inventory quantities", async function () {
    await assert.rejects(
      client.query(
        `
          INSERT INTO inventory (
            variant_id,
            quantity_on_hand
          )
          VALUES ($1, $2)
        `,
        [
          "00000000-0000-0000-0000-000000000001",
          -5
        ]
      ),
      (error) => error.code === "23514"
    );
  });

  it("calculates order totals automatically", async function () {
    const user = await client.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        "Order",
        "Tester",
        "order-total-test@naude.local",
        "fake_hash"
      ]
    );

    const result = await client.query(
      `
        INSERT INTO orders (
          user_id,
          subtotal,
          shipping_amount,
          shipping_address
        )
        VALUES ($1, $2, $3, $4)
        RETURNING total_amount
      `,
      [
        user.rows[0].id,
        "1798.00",
        "100.00",
        JSON.stringify({
          line1: "10 Example Street",
          city: "Johannesburg",
          country: "ZA"
        })
      ]
    );

    assert.equal(result.rows[0].total_amount, "1898.00");
  });
});

