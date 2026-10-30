
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

describe("NAUDÉ Product API", function () {
  const createdProductIds = [];

  // Create a temporary product for testing.
  async function createTestProduct(status = "active") {
    const slug = `test-product-${randomUUID()}`;

    const result = await pool.query(
      `
        INSERT INTO products (
          name,
          slug,
          description,
          category,
          base_price,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, slug, status
      `,
      [
        "NAUDÉ Test Leggings",
        slug,
        "Temporary product for API testing",
        "leggings",
        "899.00",
        status
      ]
    );

    const product = result.rows[0];

    createdProductIds.push(product.id);

    return product;
  }

  // Create a variant belonging to a test product.
  async function createTestVariant(
    productId,
    isActive = true
  ) {
    const sku = `TEST-${randomUUID()}`;

    const result = await pool.query(
      `
        INSERT INTO product_variants (
          product_id,
          sku,
          color,
          size,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, sku
      `,
      [
        productId,
        sku,
        "Black",
        "M",
        isActive
      ]
    );

    return result.rows[0];
  }

  // Create inventory for a variant.
  async function createTestInventory(
    variantId,
    quantityOnHand,
    quantityReserved = 0
  ) {
    await pool.query(
      `
        INSERT INTO inventory (
          variant_id,
          quantity_on_hand,
          quantity_reserved
        )
        VALUES ($1, $2, $3)
      `,
      [
        variantId,
        quantityOnHand,
        quantityReserved
      ]
    );
  }

  // Remove test data after each test.
  afterEach(async function () {
    const productIds = createdProductIds.splice(0);

    if (productIds.length === 0) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          DELETE FROM inventory
          WHERE variant_id IN (
            SELECT id
            FROM product_variants
            WHERE product_id = ANY($1::uuid[])
          )
        `,
        [productIds]
      );

      await client.query(
        `
          DELETE FROM product_variants
          WHERE product_id = ANY($1::uuid[])
        `,
        [productIds]
      );

      await client.query(
        `
          DELETE FROM products
          WHERE id = ANY($1::uuid[])
        `,
        [productIds]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  // Close database connections after all tests.
  after(async function () {
    await pool.end();
  });

  it("GET /api/products returns a product array", async function () {
    const response = await request(app)
      .get("/api/products");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    assert.ok(
      Array.isArray(response.body.data)
    );

    assert.equal(
      response.body.count,
      response.body.data.length
    );
  });

  it("returns an active product by slug", async function () {
    const product = await createTestProduct();

    const response = await request(app)
      .get(`/api/products/${product.slug}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    assert.equal(
      response.body.data.slug,
      product.slug
    );

    assert.ok(
      Array.isArray(response.body.data.variants)
    );
  });

  it("does not expose draft products", async function () {
    const product = await createTestProduct("draft");

    const response = await request(app)
      .get(`/api/products/${product.slug}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
  });

  it("returns 404 for an unknown product", async function () {
    const unknownSlug = `missing-${randomUUID()}`;

    const response = await request(app)
      .get(`/api/products/${unknownSlug}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);

    assert.equal(
      response.body.message,
      "Product not found"
    );
  });

  it("returns active variants with available stock", async function () {
    const product = await createTestProduct();

    const variant = await createTestVariant(product.id);

    await createTestInventory(
      variant.id,
      20,
      5
    );

    const response = await request(app)
      .get(`/api/products/${product.slug}`);

    assert.equal(response.status, 200);

    const variants = response.body.data.variants;

    assert.equal(variants.length, 1);
    assert.equal(variants[0].sku, variant.sku);

    assert.equal(
      Number(variants[0].available_quantity),
      15
    );

    assert.equal(variants[0].in_stock, true);
  });

  it("marks zero-stock variants as out of stock", async function () {
    const product = await createTestProduct();

    const variant = await createTestVariant(product.id);

    await createTestInventory(
      variant.id,
      0,
      0
    );

    const response = await request(app)
      .get(`/api/products/${product.slug}`);

    assert.equal(response.status, 200);

    const variants = response.body.data.variants;

    assert.equal(variants.length, 1);

    assert.equal(
      Number(variants[0].available_quantity),
      0
    );

    assert.equal(variants[0].in_stock, false);
  });

  it("treats missing inventory as zero stock", async function () {
    const product = await createTestProduct();

    await createTestVariant(product.id);

    const response = await request(app)
      .get(`/api/products/${product.slug}`);

    assert.equal(response.status, 200);

    const variants = response.body.data.variants;

    assert.equal(variants.length, 1);

    assert.equal(
      Number(variants[0].available_quantity),
      0
    );

    assert.equal(variants[0].in_stock, false);
  });

  it("does not expose inactive variants", async function () {
    const product = await createTestProduct();

    await createTestVariant(
      product.id,
      false
    );

    const response = await request(app)
      .get(`/api/products/${product.slug}`);

    assert.equal(response.status, 200);

    assert.deepEqual(
      response.body.data.variants,
      []
    );
  });
});
