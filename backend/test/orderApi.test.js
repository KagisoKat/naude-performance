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

  it("requires sign-in to view an individual order", async function () {
    await request(app).get(`/api/orders/${randomUUID()}`).expect(401);
  });

  it("returns only the signed-in customer's orders, newest first", async function () {
    const customerId = randomUUID();
    const otherCustomerId = randomUUID();
    const customerIds = [customerId, otherCustomerId];
    const productId = randomUUID();
    const variantId = randomUUID();
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
      const itemId = randomUUID();
      const sku = `ORDER-TEST-${variantId}`;

      await pool.query(
        `INSERT INTO products (id, name, slug, category, base_price, status)
         VALUES ($1, 'Current Catalogue Leggings', $2, 'leggings', 999.00, 'active')`,
        [productId, `order-details-${productId}`]
      );

      await pool.query(
        `INSERT INTO product_variants (id, product_id, sku, color, size)
         VALUES ($1, $2, $3, 'Black', 'M')`,
        [variantId, productId, sku]
      );

      await pool.query(
        `INSERT INTO order_items (
           id, order_id, variant_id, product_name, sku, color, size, quantity, unit_price
         )
         VALUES ($1, $2, $3, 'Original Leggings', $4, 'Black', 'M', 2, 449.50)`,
        [itemId, newerId, variantId, sku]
      );

      const detailPath = `/api/orders/${newerId}`;
      const detail = await customer.get(detailPath).expect(200);

      assert.equal(detail.body.success, true);
      assert.equal(detail.body.order.id, newerId);
      assert.equal(detail.body.order.total_amount, "899.00");
      assert.deepEqual(detail.body.order.items, [{
        id: itemId,
        product_name: "Original Leggings",
        sku,
        color: "Black",
        size: "M",
        quantity: 2,
        unit_price: "449.50",
        line_total: "899.00"
      }]);

      const missingOrder = {
        success: false,
        message: "Order not found"
      };

      await otherCustomer.get(detailPath).expect(404, missingOrder);
      await customer.get(`/api/orders/${randomUUID()}`).expect(404, missingOrder);

      await customer.get("/api/orders/abc").expect(400, {
        success: false,
        message: "Order ID must be a valid UUID"
      });

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

    await pool.query(
      `INSERT INTO inventory (
         variant_id, quantity_on_hand, quantity_reserved
       )
       VALUES ($1, 5, 2)`,
      [variantId]
    );

    const cancelPath = `/api/orders/${newerId}/cancel`;

    await request(app).post(cancelPath)
      .set("Origin", origin)
      .expect(401);

    await customer.post(cancelPath)
      .set("Origin", origin)
      .expect(403);

    const { body: ownerToken } = await customer
      .get("/api/auth/csrf-token")
      .expect(200);

    const { body: otherToken } = await otherCustomer
      .get("/api/auth/csrf-token")
      .expect(200);

    await otherCustomer.post(cancelPath)
      .set("Origin", origin)
      .set("X-CSRF-Token", otherToken.csrfToken)
      .expect(404, {
        success: false,
        message: "Order not found"
      });

    await customer.post("/api/orders/abc/cancel")
      .set("Origin", origin)
      .set("X-CSRF-Token", ownerToken.csrfToken)
      .expect(400);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const cancelled = await customer.post(cancelPath)
        .set("Origin", origin)
        .set("X-CSRF-Token", ownerToken.csrfToken)
        .expect(200);

      assert.equal(cancelled.body.success, true);
      assert.equal(cancelled.body.order.id, newerId);
      assert.equal(cancelled.body.order.status, "cancelled");
      assert.equal(cancelled.body.order.payment_status, "unpaid");
    }

    const { rows: [releasedStock] } = await pool.query(
      `SELECT quantity_on_hand, quantity_reserved
       FROM inventory WHERE variant_id = $1`,
      [variantId]
    );

    assert.deepEqual(releasedStock, {
      quantity_on_hand: 5,
      quantity_reserved: 0
    });

    const cancelledDetail = await customer
      .get(`/api/orders/${newerId}`)
      .expect(200);

    assert.equal(cancelledDetail.body.order.status, "cancelled");
    assert.equal(cancelledDetail.body.order.items.length, 1);
    } finally {
      await pool.query("DELETE FROM order_items WHERE variant_id = $1", [variantId]);
      await pool.query("DELETE FROM orders WHERE user_id = ANY($1::uuid[])", [customerIds]);
      await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
      await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
      await pool.query("DELETE FROM products WHERE id = $1", [productId]);
      await pool.query(
        "DELETE FROM user_sessions WHERE sess->>'userId' = ANY($1::text[])",
        [customerIds]
      );
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [customerIds]);
    }
  });
});
