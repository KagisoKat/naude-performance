
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

describe("NAUDÉ Login and Session API", function () {
  this.timeout(10000);

  const createdUserIds = new Set();
  const agents = [];

  async function createTestUser(options = {}) {
    const password = "SecureTestPassword123!";
    const email = `login-${randomUUID()}@example.com`;

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    const result = await pool.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash,
          role,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email
      `,
      [
        "NAUDÉ",
        "Test",
        email,
        passwordHash,
        "customer",
        options.isActive ?? true
      ]
    );

    const user = result.rows[0];

    createdUserIds.add(user.id);

    return {
      ...user,
      password
    };
  }

  function createAgent() {
    const agent = request.agent(app);
    agents.push(agent);
    return agent;
  }

  before(async function () {
    if (process.env.DB_NAME !== "naude_test") {
      throw new Error(
        "Login tests must run against naude_test"
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

  afterEach(async function () {
    // Remove sessions created by the current test.
    // Test sessions contain a userId in the JSON data.
    const ids = [...createdUserIds];

    if (ids.length > 0) {
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
    }

    createdUserIds.clear();
    agents.length = 0;
  });

  after(async function () {
    await pool.end();
  });

  it("logs in with correct credentials", async function () {
    const user = await createTestUser();
    const agent = createAgent();

    const response = await agent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.id, user.id);

    const cookies = response.headers["set-cookie"];

    assert.ok(cookies);
    assert.ok(
      cookies.some((cookie) =>
        cookie.startsWith("naude.sid=")
      )
    );
  });

  it("rejects an incorrect password", async function () {
    const user = await createTestUser();

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: "IncorrectPassword123!"
      });

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  });

  it("rejects an unknown email", async function () {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: `unknown-${randomUUID()}@example.com`,
        password: "SecureTestPassword123!"
      });

    assert.equal(response.status, 401);
  });

  it("allows a logged-in customer to access /me", async function () {
    const user = await createTestUser();
    const agent = createAgent();

    await agent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password
      })
      .expect(200);

    const response = await agent
      .get("/api/auth/me");

    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, user.id);
    assert.equal(response.body.data.email, user.email);

    assert.equal(
      response.body.data.password_hash,
      undefined
    );
  });

  it("rejects unauthenticated access to /me", async function () {
    const response = await request(app)
      .get("/api/auth/me");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  });

  it("persists a session across multiple requests", async function () {
    const user = await createTestUser();
    const agent = createAgent();

    await agent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password
      })
      .expect(200);

    const firstResponse = await agent
      .get("/api/auth/me");

    const secondResponse = await agent
      .get("/api/auth/me");

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);

    assert.equal(
      firstResponse.body.data.id,
      secondResponse.body.data.id
    );
  });

  it("logs out successfully", async function () {
    const user = await createTestUser();
    const agent = createAgent();

    await agent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password
      })
      .expect(200);

    const response = await agent
      .post("/api/auth/logout");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
  });

  it("denies protected access after logout", async function () {
    const user = await createTestUser();
    const agent = createAgent();

    await agent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password
      })
      .expect(200);

    await agent
      .post("/api/auth/logout")
      .expect(200);

    const response = await agent
      .get("/api/auth/me");

    assert.equal(response.status, 401);
  });

  it("rejects login for deactivated accounts", async function () {
    const user = await createTestUser({
      isActive: false
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password
      });

    assert.equal(response.status, 401);
  });

  it("revokes protected access when an account is deactivated", async function () {
    const user = await createTestUser();
    const agent = createAgent();

    await agent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password
      })
      .expect(200);

    await pool.query(
      `
        UPDATE users
        SET is_active = false
        WHERE id = $1
      `,
      [user.id]
    );

    const response = await agent
      .get("/api/auth/me");

    assert.equal(response.status, 401);
  });
});

