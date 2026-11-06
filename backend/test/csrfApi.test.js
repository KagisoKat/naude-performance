
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

const ORIGIN = "http://192.168.56.10:5173";

describe("NAUDÉ CSRF Protection", function () {
  this.timeout(15000);

  let user;
  let agent;

  before(async function () {
    if (process.env.DB_NAME !== "naude_test") {
      throw new Error("CSRF tests require naude_test");
    }

    const result = await pool.query(
      "SELECT current_database() AS name"
    );

    assert.equal(result.rows[0].name, "naude_test");

    const password = "SecureTestPassword123!";
    const email = `csrf-${randomUUID()}@example.com`;
    const hash = await argon2.hash(password);

    const inserted = await pool.query(
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
      ["CSRF", "Test", email, hash]
    );

    user = {
      id: inserted.rows[0].id,
      email,
      password
    };

    agent = request.agent(app);

    await agent
      .post("/api/auth/login")
      .set("Origin", ORIGIN)
      .send({
        email: user.email,
        password: user.password
      })
      .expect(200);
  });

  after(async function () {
    try {
      if (user?.id) {
        await pool.query(
          `
            DELETE FROM user_sessions
            WHERE sess->>'userId' = $1
          `,
          [user.id]
        );

        await pool.query(
          "DELETE FROM users WHERE id = $1",
          [user.id]
        );
      }
    } finally {
      await pool.end();
    }
  });

  it("rejects an unauthenticated CSRF token request", async function () {
    const response = await request(app)
      .get("/api/auth/csrf-token");

    assert.equal(response.status, 401);
  });

  it("returns a CSRF token for an authenticated customer", async function () {
    const response = await agent
      .get("/api/auth/csrf-token");

    assert.equal(response.status, 200);
    assert.equal(typeof response.body.csrfToken, "string");
    assert.equal(response.body.csrfToken.length, 64);
  });

  it("rejects logout without a CSRF token", async function () {
    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", ORIGIN);

    assert.equal(response.status, 403);
  });

  it("rejects logout with an invalid CSRF token", async function () {
    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", "invalid-token");

    assert.equal(response.status, 403);
  });

  it("rejects requests from an untrusted origin", async function () {
    const tokenResponse = await agent
      .get("/api/auth/csrf-token")
      .expect(200);

    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", "https://untrusted.example")
      .set("X-CSRF-Token", tokenResponse.body.csrfToken);

    assert.equal(response.status, 403);
  });

  it("accepts logout with a valid CSRF token", async function () {
    const tokenResponse = await agent
      .get("/api/auth/csrf-token")
      .expect(200);

    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", tokenResponse.body.csrfToken);

    assert.equal(response.status, 200);

    const profileResponse = await agent
      .get("/api/auth/me");

    assert.equal(profileResponse.status, 401);
  });
});

