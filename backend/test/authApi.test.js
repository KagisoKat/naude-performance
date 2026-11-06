
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/db.js";

// Trusted frontend origin for authentication requests.
const ORIGIN =
  process.env.FRONTEND_ORIGIN ??
  "http://192.168.56.10:5173";

describe("NAUDÉ Authentication API", function () {
  this.timeout(15000);

  const testEmails = new Set();

  function createTestUser(overrides = {}) {
    const email = `test-${randomUUID()}@example.com`;

    testEmails.add(email);

    return {
      first_name: "Kagiso",
      last_name: "Test",
      email,
      password: "SecureTestPassword123!",
      ...overrides
    };
  }

  before(async function () {
    if (process.env.DB_NAME !== "naude_test") {
      throw new Error(
        "Authentication tests must use naude_test"
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
    const emails = [...testEmails];

    if (emails.length === 0) {
      return;
    }

    await pool.query(
      `
        DELETE FROM users
        WHERE email = ANY($1::text[])
      `,
      [emails]
    );

    testEmails.clear();
  });

  after(async function () {
    await pool.end();
  });

  it("registers a customer successfully", async function () {
    const user = createTestUser();

    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send(user);

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    assert.equal(
      response.body.data.email,
      user.email
    );

    assert.equal(
      response.body.data.role,
      "customer"
    );

    assert.ok(response.body.data.id);
  });

  it("stores a hashed password instead of plaintext", async function () {
    const user = createTestUser();

    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send(user);

    assert.equal(response.status, 201);

    const result = await pool.query(
      `
        SELECT password_hash
        FROM users
        WHERE email = $1
      `,
      [user.email]
    );

    assert.equal(result.rows.length, 1);

    const storedHash = result.rows[0].password_hash;

    assert.notEqual(storedHash, user.password);

    assert.ok(storedHash.startsWith("$argon2id$"));

    const matches = await argon2.verify(
      storedHash,
      user.password
    );

    assert.equal(matches, true);
  });

  it("does not expose passwords or password hashes", async function () {
    const user = createTestUser();

    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send(user);

    assert.equal(response.status, 201);

    assert.equal(
      response.body.data.password,
      undefined
    );

    assert.equal(
      response.body.data.password_hash,
      undefined
    );
  });

  it("rejects duplicate emails regardless of case", async function () {
    const user = createTestUser();

    const firstResponse = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send(user);

    assert.equal(firstResponse.status, 201);

    const secondResponse = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send({
        ...user,
        email: user.email.toUpperCase()
      });

    assert.equal(secondResponse.status, 409);
    assert.equal(secondResponse.body.success, false);
  });

  it("rejects invalid email addresses", async function () {
    const user = createTestUser({
      email: "invalid-email"
    });

    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send(user);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  });

  it("rejects passwords shorter than 12 characters", async function () {
    const user = createTestUser({
      password: "12345"
    });

    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send(user);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  });

  it("prevents customers from assigning admin roles", async function () {
    const user = createTestUser({
      role: "admin"
    });

    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send(user);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  });

  it("rejects missing required fields", async function () {
    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", ORIGIN)
      .send({
        first_name: "Test"
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  });
});
