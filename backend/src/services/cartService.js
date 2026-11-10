
import pool from "../config/db.js";

export async function getCartByUserId(userId) {
  // First, find the cart belonging to this customer.
  const cartResult = await pool.query(
    `
      SELECT id
      FROM carts
      WHERE user_id = $1
    `,
    [userId]
  );

  // A new customer may not have a cart yet.
  if (cartResult.rows.length === 0) {
    return {
      id: null,
      items: [],
      itemCount: 0,
      subtotal: "0.00"
    };
  }

  const cartId = cartResult.rows[0].id;

  // Retrieve the items and their current product information.
  const itemsResult = await pool.query(
    `
      SELECT
        ci.id,
        ci.variant_id AS "variantId",
        ci.quantity,
        p.name AS "productName",
        p.slug AS "productSlug",
        p.status AS "productStatus",
        pv.sku,
        pv.color,
        pv.size,
        pv.is_active AS "variantActive",
        COALESCE(
          pv.price_override,
          p.base_price
        ) AS "unitPrice",
        (
          ci.quantity *
          COALESCE(pv.price_override, p.base_price)
        ) AS "lineTotal",
        GREATEST(
          COALESCE(i.quantity_on_hand, 0) -
          COALESCE(i.quantity_reserved, 0),
          0
        ) AS "availableStock"
      FROM cart_items ci
      JOIN product_variants pv
        ON pv.id = ci.variant_id
      JOIN products p
        ON p.id = pv.product_id
      LEFT JOIN inventory i
        ON i.variant_id = pv.id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at, ci.id
    `,
    [cartId]
  );

  const items = itemsResult.rows.map((item) => ({
    ...item,
    availableStock: Number(item.availableStock),
    isAvailable:
      item.productStatus === "active" &&
      item.variantActive &&
      item.quantity <= Number(item.availableStock)
  }));

  // Calculate totals in PostgreSQL using NUMERIC,
  // avoiding JavaScript floating-point money calculations.
  const totalsResult = await pool.query(
    `
      SELECT
        COALESCE(SUM(ci.quantity), 0)::integer
          AS "itemCount",
        COALESCE(
          SUM(
            ci.quantity *
            COALESCE(pv.price_override, p.base_price)
          ),
          0
        )::numeric(12, 2) AS subtotal
      FROM cart_items ci
      JOIN product_variants pv
        ON pv.id = ci.variant_id
      JOIN products p
        ON p.id = pv.product_id
      WHERE ci.cart_id = $1
    `,
    [cartId]
  );

  return {
    id: cartId,
    items,
    itemCount: totalsResult.rows[0].itemCount,
    subtotal: totalsResult.rows[0].subtotal
  };
}
