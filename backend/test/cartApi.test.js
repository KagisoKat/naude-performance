import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

const origin = process.env.FRONTEND_ORIGIN ?? "http://192.168.56.10:5173";
const password = "SecureTestPassword123!";

describe("NAUDÉ Cart API", function () {
  this.timeout(15000);

  const userIds = [];
  const productIds = [];
  let passwordHash;

  before(async function () {
    assert.equal(process.env.DB_NAME, "naude_test");
    const { rows } = await pool.query("SELECT current_database() AS name");
    assert.equal(rows[0].name, "naude_test");
    passwordHash = await argon2.hash(password);
  });

  async function createCustomer() {
    const email = `cart-${randomUUID()}@example.com`;
    const { rows } = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ('Cart', 'Test', $1, $2, 'customer') RETURNING id`,
      [email, passwordHash]
    );
    const id = rows[0].id;
    userIds.push(id);
    return { id, email };
  }

  async function login(customer) {
    const agent = request.agent(app);
    await agent.post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: customer.email, password })
      .expect(200);
    return agent;
  }

  async function createCart(userId) {
    const { rows } = await pool.query(
      "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
      [userId]
    );
    return rows[0].id;
  }

  afterEach(async function () {
    if (userIds.length === 0 && productIds.length === 0) {
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM user_sessions WHERE sess->>'userId' = ANY($1::text[])",
        [userIds]
      );
      await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
      await client.query(
        `DELETE FROM inventory WHERE variant_id IN (
           SELECT id FROM product_variants WHERE product_id = ANY($1::uuid[])
         )`,
        [productIds]
      );
      await client.query(
        "DELETE FROM product_variants WHERE product_id = ANY($1::uuid[])",
        [productIds]
      );
      await client.query("DELETE FROM products WHERE id = ANY($1::uuid[])", [productIds]);
      await client.query("COMMIT");
      userIds.length = 0;
      productIds.length = 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  after(async function () {
    await pool.end();
  });

  it("rejects unauthenticated requests", async function () {
    await request(app).get("/api/cart").expect(401, {
      success: false,
      message: "Authentication required"
    });
  });

  it("returns an empty result without creating a cart", async function () {
    const customer = await createCustomer();
    const agent = await login(customer);
    await agent.get("/api/cart").expect(200, {
      success: true,
      cart: { id: null, items: [], itemCount: 0, subtotal: "0.00" }
    });
    const { rows } = await pool.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [customer.id]
    );
    assert.deepEqual(rows, []);
  });

  it("returns the ID of an existing empty cart", async function () {
    const customer = await createCustomer();
    const cartId = await createCart(customer.id);
    const agent = await login(customer);
    await agent.get("/api/cart").expect(200, {
      success: true,
      cart: { id: cartId, items: [], itemCount: 0, subtotal: "0.00" }
    });
  });

  it("returns only the signed-in customer's items with current prices and stock", async function () {
    const customer = await createCustomer();
    const otherCustomer = await createCustomer();
    const cartId = await createCart(customer.id);
    const otherCartId = await createCart(otherCustomer.id);
    const slug = `test-cart-${randomUUID()}`;
    const { rows: [product] } = await pool.query(
      `INSERT INTO products (name, slug, category, base_price, status)
       VALUES ('Test Leggings', $1, 'leggings', 19.99, 'active') RETURNING id`,
      [slug]
    );
    productIds.push(product.id);

    const { rows: [medium, large] } = await pool.query(
      `INSERT INTO product_variants (product_id, sku, color, size, price_override)
       VALUES ($1, $2, 'Black', 'M', 12.34), ($1, $3, 'Black', 'L', NULL)
       RETURNING id, sku`,
      [product.id, `TEST-${randomUUID()}`, `TEST-${randomUUID()}`]
    );
    await pool.query(
      `INSERT INTO inventory (variant_id, quantity_on_hand, quantity_reserved)
       VALUES ($1, 5, 3)`,
      [medium.id]
    );
    await pool.query(
      `INSERT INTO cart_items (cart_id, variant_id, quantity)
       VALUES ($1, $3, 2), ($1, $4, 1), ($2, $3, 9)`,
      [cartId, otherCartId, medium.id, large.id]
    );

    const agent = await login(customer);
    const response = await agent.get("/api/cart")
      .query({ userId: otherCustomer.id, cartId: otherCartId })
      .expect(200);
    const { success, cart } = response.body;
    assert.equal(success, true);
    assert.equal(cart.id, cartId);
    assert.equal(cart.itemCount, 3);
    assert.equal(cart.subtotal, "44.67");
    assert.equal(cart.items.length, 2);

    const items = new Map(cart.items.map((item) => [item.variantId, item]));
    const overrideItem = items.get(medium.id);
    assert.equal(overrideItem.productSlug, slug);
    assert.equal(overrideItem.sku, medium.sku);
    assert.equal(overrideItem.quantity, 2);
    assert.equal(overrideItem.unitPrice, "12.34");
    assert.equal(overrideItem.lineTotal, "24.68");
    assert.equal(overrideItem.availableStock, 2);
    assert.equal(overrideItem.isAvailable, true);

    const basePriceItem = items.get(large.id);
    assert.equal(basePriceItem.quantity, 1);
    assert.equal(basePriceItem.unitPrice, "19.99");
    assert.equal(basePriceItem.lineTotal, "19.99");
    assert.equal(basePriceItem.availableStock, 0);
    assert.equal(basePriceItem.isAvailable, false);
  });
});
