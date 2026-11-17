import argon2 from "argon2";
import request from "supertest";

import app from "../src/app.js";import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/config/db.js";
import { checkoutCart } from "../src/services/checkoutService.js";

describe("Checkout service", function () {
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

    for (const mode of ["sequential", "concurrent", "http"]) {
    it(`saves one order and preserves the rejected cart (${mode})`, async function () {
    const customerIds = [randomUUID(), randomUUID()];
    const cartIds = [randomUUID(), randomUUID()];
    const productId = randomUUID();
    const variantId = randomUUID();
          const shippingAddress = {
        line1: "10 Test Street",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "0083"
      };
      const origin = process.env.FRONTEND_ORIGIN ?? "http://192.168.56.10:5173";
      const password = "CheckoutFixtureOnly123!";

    try {
      const passwordHash = await argon2.hash(password);
      await pool.query(
                  `INSERT INTO users (id, email, first_name, last_name, password_hash, role)
           VALUES ($1, $2, 'Checkout', 'Test', $5, 'customer'),
                  ($3, $4, 'Checkout', 'Test', $5, 'customer')`,
          [
            customerIds[0], `checkout-${customerIds[0]}@example.com`,
            customerIds[1], `checkout-${customerIds[1]}@example.com`,
            passwordHash
          ]
      );

      await pool.query(
        `INSERT INTO products (id, name, slug, category, base_price, status)
         VALUES ($1, 'Test Leggings', $2, 'leggings', 899.00, 'active')`,
        [productId, `checkout-${productId}`]
      );

      await pool.query(
        `INSERT INTO product_variants (id, product_id, sku, color, size, price_override)
         VALUES ($1, $2, $3, 'Black', 'M', 799.00)`,
        [variantId, productId, `TEST-${variantId}`]
      );

      await pool.query(
        "INSERT INTO inventory (variant_id, quantity_on_hand) VALUES ($1, 3)",
        [variantId]
      );

      await pool.query(
        "INSERT INTO carts (id, user_id) VALUES ($1, $2), ($3, $4)",
        [cartIds[0], customerIds[0], cartIds[1], customerIds[1]]
      );

      await pool.query(
        `INSERT INTO cart_items (cart_id, variant_id, quantity)
         VALUES ($1, $3, 2), ($2, $3, 2)`,
        [cartIds[0], cartIds[1], variantId]
      );

            let results;

      if (mode === "concurrent") {
        results = await Promise.all(
          customerIds.map((customerId) => checkoutCart(customerId, shippingAddress))
        );
	              } else if (mode === "http") {
          await request(app).post("/api/checkout")
            .set("Origin", origin)
            .send({ shippingAddress })
            .expect(401);

          results = [];

          for (const [index, customerId] of customerIds.entries()) {
            const agent = request.agent(app);
            await agent.post("/api/auth/login")
              .set("Origin", origin)
              .send({
                email: `checkout-${customerId}@example.com`,
                password
              })
              .expect(200);

            if (index === 0) {
              await agent.post("/api/checkout")
                .set("Origin", origin)
                .send({ shippingAddress })
                .expect(403);
            }

            const { body: { csrfToken } } = await agent
              .get("/api/auth/csrf-token")
              .expect(200);

            if (index === 0) {
              const invalid = await agent.post("/api/checkout")
                .set("Origin", origin)
                .set("X-CSRF-Token", csrfToken)
                .send({ shippingAddress: {} })
                .expect(400);

              assert.equal(invalid.body.message, "A valid shipping address is required");
            }

            const response = await agent.post("/api/checkout")
              .set("Origin", origin)
              .set("X-CSRF-Token", csrfToken)
              .send({ shippingAddress })
              .expect(index === 0 ? 201 : 409);

            if (index === 0) {
              assert.equal(response.body.success, true);
              results.push({ outcome: "order_created", order: response.body.order });
            } else {
              assert.equal(response.body.success, false);
              assert.equal(response.body.message, "Not enough stock to check out");
              results.push({
                outcome: "insufficient_stock",
                variantId: response.body.variantId,
                availableStock: response.body.availableStock
              });
            }
          }
        } else {
        results = [];
        for (const customerId of customerIds) {
          results.push(await checkoutCart(customerId, shippingAddress));
        }
      }

      assert.deepEqual(
        results.map((result) => result.outcome).sort(),
        ["insufficient_stock", "order_created"]
      );

      const accepted = results.find((result) => result.outcome === "order_created");
      const rejectedIndex = results.findIndex(
        (result) => result.outcome === "insufficient_stock"
      );
      assert.equal(accepted.outcome, "order_created");
      assert.equal(accepted.order.status, "pending");
      assert.equal(accepted.order.payment_status, "unpaid");
      assert.equal(accepted.order.subtotal, "1598.00");
      assert.equal(accepted.order.total_amount, "1598.00");

      const { rows: orderLines } = await pool.query(
        `SELECT product_name, quantity, unit_price, line_total
         FROM order_items WHERE order_id = $1`,
        [accepted.order.id]
      );
      assert.deepEqual(orderLines, [{
        product_name: "Test Leggings",
        quantity: 2,
        unit_price: "799.00",
        line_total: "1598.00"
      }]);

      const rejected = await checkoutCart(
        customerIds[rejectedIndex],
        shippingAddress
      );
      assert.deepEqual(rejected, {
        outcome: "insufficient_stock",
        variantId,
        availableStock: 1
      });

      const { rows: [stock] } = await pool.query(
        `SELECT quantity_on_hand, quantity_reserved
         FROM inventory WHERE variant_id = $1`,
        [variantId]
      );
      assert.deepEqual(stock, {
        quantity_on_hand: 3,
        quantity_reserved: 2
      });

      const { rows: remainingLines } = await pool.query(
        "SELECT cart_id, quantity FROM cart_items WHERE cart_id = ANY($1::uuid[])",
        [cartIds]
      );
      assert.deepEqual(remainingLines, [{
        cart_id: cartIds[rejectedIndex],
        quantity: 2
      }]);

      const { rows: [orderCount] } = await pool.query(
        "SELECT count(*)::int AS count FROM orders WHERE user_id = ANY($1::uuid[])",
        [customerIds]
      );
      assert.equal(orderCount.count, 1);
    } finally {
      await pool.query(
        `DELETE FROM order_items
         WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::uuid[]))`,
        [customerIds]
      );
      await pool.query("DELETE FROM orders WHERE user_id = ANY($1::uuid[])", [customerIds]);
      await pool.query("DELETE FROM cart_items WHERE cart_id = ANY($1::uuid[])", [cartIds]);
      await pool.query("DELETE FROM carts WHERE id = ANY($1::uuid[])", [cartIds]);
      await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
      await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
      await pool.query(
                      "DELETE FROM user_sessions WHERE sess->>'userId' = ANY($1::text[])",
          [customerIds]
        );
      await pool.query("DELETE FROM products WHERE id = $1", [productId]);
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [customerIds]);
    }
    });
  }
});
