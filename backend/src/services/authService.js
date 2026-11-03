
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

