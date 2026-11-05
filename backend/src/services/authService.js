
import argon2 from "argon2";
import pool from "../config/db.js";

export async function registerUser(userData) {
  const {
    first_name,
    last_name,
    email,
    password
  } = userData;

  // Hash the password before storing it.
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  try {
    const result = await pool.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, $4, 'customer')
        RETURNING
          id,
          first_name,
          last_name,
          email,
          role,
          created_at
      `,
      [
        first_name,
        last_name,
        email,
        passwordHash
      ]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(
        "An account with this email already exists"
      );

      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
}

export async function authenticateUser(email, password) {
  const result = await pool.query(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        role,
        is_active,
        password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  const user = result.rows[0];

  if (!user || !user.is_active) {
    return null;
  }

  const validPassword = await argon2.verify(
    user.password_hash,
    password
  );

  if (!validPassword) {
    return null;
  }

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role
  };
}

export async function findActiveUserById(userId) {
  const result = await pool.query(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        role
      FROM users
      WHERE id = $1
        AND is_active = true
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

