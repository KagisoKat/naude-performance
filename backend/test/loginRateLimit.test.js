
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

describe("NAUDÉ Login Rate Limiting", function () {
  this.timeout(15000);

  before(async function () {
    if (process.env.DB_NAME !== "naude_test") {
      throw new Error(
        "Rate-limit tests must use naude_test"
      );
    }

    const result = await pool.query(
      "SELECT current_database() AS database_name"
    );

    assert.equal(
      result.rows[0].database_name,
      "naude_test"
    );
  });

  after(async function () {
    await pool.end();
  });

  it("blocks login requests after five failed attempts", async function () {
    const credentials = {
      email: `unknown-${randomUUID()}@example.com`,
      password: "IncorrectPassword123!"
    };

    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await request(app)
        .post("/api/auth/login")
        .send(credentials);

      assert.equal(response.status, 401);
    }

    const blockedResponse = await request(app)
      .post("/api/auth/login")
      .send(credentials);

    assert.equal(blockedResponse.status, 429);

    assert.equal(
      blockedResponse.body.success,
      false
    );

    assert.ok(
      blockedResponse.headers["retry-after"]
    );
  });
});

