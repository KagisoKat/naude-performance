
import pool from "../config/db.js";

export async function getAllProducts() {
  const result = await pool.query(`
    SELECT
      id,
      name,
      slug,
      description,
      category,
      base_price,
      status,
      created_at
    FROM products
    WHERE status = 'active'
    ORDER BY created_at DESC, id DESC
  `);

  return result.rows;
}

export async function getProductBySlug(slug) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        slug,
        description,
        category,
        base_price,
        status
      FROM products
      WHERE slug = $1
        AND status = 'active'
    `,
    [slug]
  );

  return result.rows[0] ?? null;
}

