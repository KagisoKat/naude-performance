
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

const ORIGIN =
  process.env.FRONTEND_ORIGIN ??
  "http://192.168.56.10:5173";

const UNTRUSTED_ORIGIN = "https://untrusted.example";

describe("NAUDÉ CSRF Protection", function () {
  this.timeout(15000);

  const createdUserIds = new Set();

  // Create a temporary customer for the current test.
  async function createTestUser() {
    const password = "SecureTestPassword123!";
    const email = `csrf-${randomUUID()}@example.com`;

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    const result = await pool.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, email
      `,
      [
        "CSRF",
        "Test",
        email,
        passwordHash
      ]
    );

    const user = result.rows[0];

    createdUserIds.add(user.id);

    return {
      ...user,
      password
    };
  }

  // Each agent maintains its own session cookies.
  function createAgent() {
    return request.agent(app);
  }

  // Create a fresh authenticated session for each test.
  async function createAuthenticatedAgent() {
    const user = await createTestUser();
    const agent = createAgent();

    const response = await agent
      .post("/api/auth/login")
      .set("Origin", ORIGIN)
      .send({
        email: user.email,
        password: user.password
      });

    assert.equal(
      response.status,
      200,
      `Login failed: ${JSON.stringify(response.body)}`
    );

    return {
      agent,
      user
    };
  }

  // Retrieve a CSRF token for the authenticated session.
  async function getCsrfToken(agent) {
    const response = await agent
      .get("/api/auth/csrf-token")
      .expect(200);

    assert.equal(response.body.success, true);

    assert.equal(
      typeof response.body.csrfToken,
      "string"
    );

    // 32 random bytes represented as 64 hexadecimal characters.
    assert.match(
      response.body.csrfToken,
      /^[a-f0-9]{64}$/
    );

    return response.body.csrfToken;
  }

  // Ensure the test suite never uses the main database.
  before(async function () {
    if (process.env.DB_NAME !== "naude_test") {
      throw new Error(
        "CSRF tests must run against naude_test"
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

  // Clean up temporary users and their sessions.
  afterEach(async function () {
    const ids = [...createdUserIds];

    if (ids.length === 0) {
      return;
    }

    await pool.query(
      `
        DELETE FROM user_sessions
        WHERE sess->>'userId' = ANY($1::text[])
      `,
      [ids]
    );

    await pool.query(
      `
        DELETE FROM users
        WHERE id = ANY($1::uuid[])
      `,
      [ids]
    );

    createdUserIds.clear();
  });

  // Close PostgreSQL connections after all tests.
  after(async function () {
    await pool.end();
  });

  it("rejects an unauthenticated CSRF token request", async function () {
    const response = await request(app)
      .get("/api/auth/csrf-token");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  });

  it("returns a CSRF token for an authenticated customer", async function () {
    const { agent } = await createAuthenticatedAgent();

    const token = await getCsrfToken(agent);

    assert.equal(token.length, 64);
  });

  it("returns the same CSRF token within an authenticated session", async function () {
    const { agent } = await createAuthenticatedAgent();

    const firstToken = await getCsrfToken(agent);
    const secondToken = await getCsrfToken(agent);

    assert.equal(firstToken, secondToken);
  });

  it("rejects logout without a CSRF token", async function () {
    const { agent, user } = await createAuthenticatedAgent();

    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", ORIGIN);

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);

    // Rejected logout must not destroy the session.
    const profileResponse = await agent
      .get("/api/auth/me");

    assert.equal(profileResponse.status, 200);
    assert.equal(profileResponse.body.data.id, user.id);
  });

  it("rejects logout with an invalid CSRF token", async function () {
    const { agent, user } = await createAuthenticatedAgent();

    await getCsrfToken(agent);

    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", "invalid-token");

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);

    // Authentication should remain valid.
    const profileResponse = await agent
      .get("/api/auth/me");

    assert.equal(profileResponse.status, 200);
    assert.equal(profileResponse.body.data.id, user.id);
  });

  it("rejects requests from an untrusted origin", async function () {
    const { agent, user } = await createAuthenticatedAgent();

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", UNTRUSTED_ORIGIN)
      .set("X-CSRF-Token", csrfToken);

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);

    // Untrusted requests must not terminate the session.
    const profileResponse = await agent
      .get("/api/auth/me");

    assert.equal(profileResponse.status, 200);
    assert.equal(profileResponse.body.data.id, user.id);
  });

  it("accepts logout with a valid CSRF token", async function () {
    const { agent } = await createAuthenticatedAgent();

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", csrfToken);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    assert.equal(
      response.body.message,
      "Logout successful"
    );

    // Logout must revoke access to protected routes.
    const profileResponse = await agent
      .get("/api/auth/me");

    assert.equal(profileResponse.status, 401);
    assert.equal(profileResponse.body.success, false);
  });
});
