
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

export async function addCartItem(userId, variantId, quantity) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create the customer's cart on their first successful add.
    await client.query(
      `
        INSERT INTO carts (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [userId]
    );

    // Make concurrent requests for this cart take turns.
    const cartResult = await client.query(
      `
        SELECT id
        FROM carts
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId]
    );
    const cartId = cartResult.rows[0].id;

    const variantResult = await client.query(
      `
        SELECT
          GREATEST(
            COALESCE(i.quantity_on_hand, 0) -
            COALESCE(i.quantity_reserved, 0),
            0
          ) AS "availableStock",
          COALESCE(ci.quantity, 0) AS "currentQuantity"
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        LEFT JOIN inventory i ON i.variant_id = pv.id
        LEFT JOIN cart_items ci
          ON ci.variant_id = pv.id AND ci.cart_id = $2
        WHERE pv.id = $1
          AND pv.is_active
          AND p.status = 'active'
      `,
      [variantId, cartId]
    );

    const variant = variantResult.rows[0];

    if (!variant) {
      await client.query("ROLLBACK");
      return { outcome: "variant_unavailable" };
    }

    const newQuantity = variant.currentQuantity + quantity;

    if (newQuantity > variant.availableStock) {
      await client.query("ROLLBACK");
      return {
        outcome: "insufficient_stock",
        availableStock: variant.availableStock
      };
    }

    const itemResult = await client.query(
      `
        INSERT INTO cart_items (cart_id, variant_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (cart_id, variant_id)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          updated_at = NOW()
        RETURNING id, variant_id AS "variantId", quantity
      `,
      [cartId, variantId, newQuantity]
    );

    await client.query("COMMIT");
    return { outcome: "added", item: itemResult.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}