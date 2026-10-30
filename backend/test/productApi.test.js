
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";

describe("NAUDÉ Product API", function () {
  it("GET /api/products returns a product array", async function () {
    const response = await request(app)
      .get("/api/products");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data));
    assert.equal(
      response.body.count,
      response.body.data.length
    );
  });

  it("GET /api/products/:slug returns 404 for an unknown product", async function () {
    const response = await request(app)
      .get("/api/products/product-that-does-not-exist");

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Product not found");
  });

  it("GET /api/products/:slug returns variants for an existing product", async function () {
    const response = await request(app)
      .get("/api/products/naude-motion-leggings");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data.variants));

    for (const variant of response.body.data.variants) {
      assert.ok(Number(variant.available_quantity) >= 0);
      assert.equal(
        variant.in_stock,
        Number(variant.available_quantity) > 0
      );
    }
  });
});

