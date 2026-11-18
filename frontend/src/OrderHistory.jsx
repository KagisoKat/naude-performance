import { useState } from "react";
import { getOrders } from "./api.js";

export default function OrderHistory({ onSessionExpired }) {
  const [orders, setOrders] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function loadOrders() {
    setPending(true);
    setError("");

    try {
      setOrders(await getOrders());
    } catch (error) {
      if (error.status === 401) {
        onSessionExpired();
        return;
      }

      setError(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="order-history-heading">
      <h2 id="order-history-heading">My orders</h2>

      <button type="button" onClick={loadOrders} disabled={pending}>
        {orders === null ? "Load orders" : "Refresh orders"}
      </button>

      {pending && <p role="status">Loading your orders…</p>}
      {error && <p role="alert">{error}</p>}

      {orders?.length === 0 && <p>No orders yet.</p>}

      {orders?.length > 0 && (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <strong>Order {order.id}</strong>
              <p>
                Placed on{" "}
                <time dateTime={order.created_at}>
                  {new Date(order.created_at).toLocaleDateString("en-ZA", {
                    timeZone: "Africa/Johannesburg"
                  })}
                </time>
              </p>
              <p>Order status: {order.status}</p>
              <p>Payment status: {order.payment_status}</p>
              <p>Total: R{order.total_amount}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
