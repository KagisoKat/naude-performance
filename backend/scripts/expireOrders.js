import pool from "../src/config/db.js";
import { cancelUnpaidOrder } from "../src/services/orderService.js";

async function expireOrders() {
  let expired = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const { rows: orders } = await pool.query(
      `
        SELECT id, user_id
        FROM orders
        WHERE status = 'pending'
          AND payment_status = 'unpaid'
          AND reservation_expires_at <= NOW()
        ORDER BY reservation_expires_at, id
        LIMIT 100
      `
    );

    for (const order of orders) {
      try {
        const result = await cancelUnpaidOrder(
          order.id,
          order.user_id,
          true
        );

        if (result.outcome === "cancelled") {
          expired += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        console.error(`Failed to expire order ${order.id}:`, error.message);
      }
    }

    console.log(JSON.stringify({
      selected: orders.length,
      expired,
      skipped,
      failed
    }));

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Order expiry job failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await expireOrders();
