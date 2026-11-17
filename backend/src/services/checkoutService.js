import pool from "../config/db.js";

export async function checkoutCart(userId, shippingAddress) {
	  let committed = false;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Use the same cart lock as add, update, and remove.
    const { rows: [cart] } = await client.query(
      `
        SELECT id
        FROM carts
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId]
    );

    if (!cart) {
      return { outcome: "empty_cart" };
    }

    const { rows: items } = await client.query(
      `
        SELECT
          ci.variant_id AS "variantId",
          ci.quantity,
          p.name AS "productName",
          pv.sku,
          pv.color,
          pv.size,
          COALESCE(pv.price_override, p.base_price) AS "unitPrice",
          p.status = 'active' AND pv.is_active AS sellable
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE ci.cart_id = $1
      `,
      [cart.id]
    );

    if (items.length === 0) {
      return { outcome: "empty_cart" };
    }

    const unavailableItem = items.find((item) => !item.sellable);

    if (unavailableItem) {
      return {
        outcome: "variant_unavailable",
        variantId: unavailableItem.variantId
      };
    }

    const variantIds = items.map((item) => item.variantId);
    const { rows: inventory } = await client.query(
      `
        SELECT
          variant_id AS "variantId",
          quantity_on_hand - quantity_reserved AS "availableStock"
        FROM inventory
        WHERE variant_id = ANY($1::uuid[])
        ORDER BY variant_id
        FOR UPDATE
      `,
      [variantIds]
    );

    const stockByVariant = new Map(
      inventory.map((row) => [row.variantId, row.availableStock])
    );

    for (const item of items) {
      const availableStock = stockByVariant.get(item.variantId) ?? 0;

      if (item.quantity > availableStock) {
        return {
          outcome: "insufficient_stock",
          variantId: item.variantId,
          availableStock
        };
      }
    }

	      const orderItems = JSON.stringify(items);

    const { rows: [order] } = await client.query(
      `
        INSERT INTO orders (user_id, subtotal, shipping_amount, shipping_address)
        SELECT $1, SUM(line.quantity * line."unitPrice"), 0, $2::jsonb
        FROM jsonb_to_recordset($3::jsonb) AS line(
          quantity integer,
          "unitPrice" numeric
        )
        RETURNING id, status, payment_status, subtotal, shipping_amount, total_amount
      `,
      [userId, JSON.stringify(shippingAddress), orderItems]
    );

    await client.query(
      `
        INSERT INTO order_items (
          order_id, variant_id, product_name, sku, color, size, quantity, unit_price
        )
        SELECT
          $1, line."variantId", line."productName", line.sku,
          line.color, line.size, line.quantity, line."unitPrice"
        FROM jsonb_to_recordset($2::jsonb) AS line(
          "variantId" uuid,
          "productName" text,
          sku text,
          color text,
          size text,
          quantity integer,
          "unitPrice" numeric
        )
      `,
      [order.id, orderItems]
    );

    await client.query(
      `
        UPDATE inventory AS stock
        SET quantity_reserved = stock.quantity_reserved + line.quantity,
            updated_at = NOW()
        FROM jsonb_to_recordset($1::jsonb) AS line(
          "variantId" uuid,
          quantity integer
        )
        WHERE stock.variant_id = line."variantId"
      `,
      [orderItems]
    );

    await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cart.id]);

    await client.query("COMMIT");
    committed = true;

    return { outcome: "order_created", order };
  } finally {
    try {
      if (!committed) {
        await client.query("ROLLBACK");
      }
    } finally {
      client.release();
    }
  }
}
