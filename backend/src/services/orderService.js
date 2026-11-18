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
