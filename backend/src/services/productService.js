
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
  const productResult = await pool.query(
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

  const product = productResult.rows[0];

  if (!product) {
    return null;
  }

  const variantsResult = await pool.query(
    `
      SELECT
        v.id,
        v.sku,
        v.color,
        v.size,

        COALESCE(
          v.price_override,
          p.base_price
        ) AS price,

        GREATEST(
          COALESCE(i.quantity_on_hand, 0)
          - COALESCE(i.quantity_reserved, 0),
          0
        ) AS available_quantity

      FROM product_variants AS v

      JOIN products AS p
        ON p.id = v.product_id

      LEFT JOIN inventory AS i
        ON i.variant_id = v.id

      WHERE v.product_id = $1
        AND v.is_active = TRUE

      ORDER BY v.color, v.size
    `,
    [product.id]
  );

  const variants = variantsResult.rows.map((variant) => ({
    ...variant,
    in_stock: Number(variant.available_quantity) > 0
  }));

  return {
    ...product,
    variants
  };
}


