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

export async function getOrderByIdForUser(orderId, userId) {
  const { rows: [order] } = await pool.query(
    `
      SELECT
        o.id,
        o.created_at,
        o.status,
        o.payment_status,
        o.subtotal,
        o.shipping_amount,
        o.total_amount,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'sku', oi.sku,
                'color', oi.color,
                'size', oi.size,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price::text,
                'line_total', oi.line_total::text
              )
              ORDER BY oi.created_at, oi.id
            )
            FROM order_items oi
            WHERE oi.order_id = o.id
          ),
          '[]'::jsonb
        ) AS items
      FROM orders o
      WHERE o.id = $1 AND o.user_id = $2
    `,
    [orderId, userId]
  );

  return order ?? null;
}
export async function cancelUnpaidOrder(orderId, userId, onlyIfExpired = false) {
  const client = await pool.connect();
  let committed = false;

  try {
    await client.query("BEGIN");

    const { rows: [order] } = await client.query(
      `
	        SELECT
          id,
          status,
          payment_status,
          reservation_expires_at <= NOW() AS reservation_expired
        FROM orders
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [orderId, userId]
    );

    if (!order) {
      return { outcome: "order_not_found" };
    }

    if (order.status === "cancelled") {
      return { outcome: "cancelled", order };
    }

    if (order.status !== "pending" || order.payment_status !== "unpaid") {
      return { outcome: "cannot_cancel" };
    }

    if (onlyIfExpired && order.reservation_expired !== true) {
      return { outcome: "not_expired" };
    }
    const { rows: items } = await client.query(
      `
        SELECT variant_id, quantity
        FROM order_items
        WHERE order_id = $1
        ORDER BY variant_id
      `,
      [order.id]
    );

    const variantIds = items.map((item) => item.variant_id);
    const { rows: inventory } = await client.query(
      `
        SELECT variant_id, quantity_reserved
        FROM inventory
        WHERE variant_id = ANY($1::uuid[])
        ORDER BY variant_id
        FOR UPDATE
      `,
      [variantIds]
    );

    const reservedByVariant = new Map(
      inventory.map((row) => [row.variant_id, row.quantity_reserved])
    );

    for (const item of items) {
      const reserved = reservedByVariant.get(item.variant_id);

      if (reserved === undefined || reserved < item.quantity) {
        throw new Error(`Reservation mismatch for order ${order.id}`);
      }
    }

    for (const item of items) {
      await client.query(
        `
          UPDATE inventory
          SET quantity_reserved = quantity_reserved - $2,
              updated_at = NOW()
          WHERE variant_id = $1
        `,
        [item.variant_id, item.quantity]
      );
    }

    const { rows: [cancelledOrder] } = await client.query(
      `
        UPDATE orders
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, payment_status
      `,
      [order.id]
    );

    await client.query("COMMIT");
    committed = true;

    return { outcome: "cancelled", order: cancelledOrder };
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
