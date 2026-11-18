import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

const origin = process.env.FRONTEND_ORIGIN ?? "http://192.168.56.10:5173";
const password = "OrderHistoryFixture123!";

describe("NAUDÉ Order API", function () {
  this.timeout(15000);

  before(async function () {
    assert.equal(process.env.DB_NAME, "naude_test");
    const { rows: [database] } = await pool.query(
      "SELECT current_database() AS name"
    );
    assert.equal(database.name, "naude_test");
  });

  after(async function () {
    await pool.end();
  });

  it("requires sign-in to view orders", async function () {
    await request(app).get("/api/orders").expect(401);
  });

  it("returns only the signed-in customer's orders, newest first", async function () {
    const customerId = randomUUID();
    const otherCustomerId = randomUUID();
    const customerIds = [customerId, otherCustomerId];
    const passwordHash = await argon2.hash(password);

    function emailFor(userId) {
      return `order-history-${userId}@example.com`;
    }

    async function signIn(userId) {
      const agent = request.agent(app);
      await agent.post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: emailFor(userId), password })
        .expect(200);
      return agent;
    }

    async function insertOrder(userId, subtotal, createdAt) {
      const { rows: [order] } = await pool.query(
        `INSERT INTO orders (user_id, subtotal, shipping_address, created_at)
         VALUES ($1, $2, '{}'::jsonb, $3)
         RETURNING id`,
        [userId, subtotal, createdAt]
      );
      return order.id;
    }

    try {
      await pool.query(
        `INSERT INTO users (id, email, first_name, last_name, password_hash, role)
         VALUES ($1, $2, 'Order', 'History', $5, 'customer'),
                ($3, $4, 'Order', 'History', $5, 'customer')`,
        [
          customerId, emailFor(customerId),
          otherCustomerId, emailFor(otherCustomerId),
          passwordHash
        ]
      );

      const customer = await signIn(customerId);
      const otherCustomer = await signIn(otherCustomerId);

      await otherCustomer.get("/api/orders").expect(200, {
        success: true,
        orders: []
      });

      const olderId = await insertOrder(customerId, "499.00", "2026-01-01T10:00:00Z");
      const newerId = await insertOrder(customerId, "899.00", "2026-01-02T10:00:00Z");
      const otherId = await insertOrder(otherCustomerId, "1299.00", "2026-01-03T10:00:00Z");

      const { body } = await customer.get("/api/orders").expect(200);

      assert.equal(body.success, true);
      assert.deepEqual(body.orders.map((order) => order.id), [newerId, olderId]);
      assert.deepEqual(body.orders[0], {
        id: newerId,
        created_at: "2026-01-02T10:00:00.000Z",
        status: "pending",
        payment_status: "unpaid",
        total_amount: "899.00"
      });

      const otherResponse = await otherCustomer.get("/api/orders").expect(200);
      assert.deepEqual(otherResponse.body.orders.map((order) => order.id), [otherId]);
    } finally {
      await pool.query("DELETE FROM orders WHERE user_id = ANY($1::uuid[])", [customerIds]);
      await pool.query(
        "DELETE FROM user_sessions WHERE sess->>'userId' = ANY($1::text[])",
        [customerIds]
      );
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [customerIds]);
    }
  });
});
