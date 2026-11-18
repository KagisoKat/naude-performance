import pool from "../config/db.js";

export async function getOrdersByUserId(userId) {
  const { rows } = await pool.query(
    `
      SELECT id, created_at, status, payment_status, total_amount
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [userId]
  );

  return rows;
}
