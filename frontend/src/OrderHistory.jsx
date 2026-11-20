import { useState } from "react";
import { cancelOrder, getOrder, getOrders } from "./api.js";
export default function OrderHistory({ onSessionExpired }) {
  const [orders, setOrders] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

	  async function handleCancelOrder(orderId) {
    if (!window.confirm("Cancel this unpaid order?")) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const cancelledOrder = await cancelOrder(orderId);

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, ...cancelledOrder } : order
        )
      );
      setSelectedOrder(null);
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

  async function toggleOrderDetails(orderId) {
    setError("");

    if (selectedOrder?.id === orderId) {
      setSelectedOrder(null);
      return;
    }

    setPending(true);
    setSelectedOrder(null);

    try {
      setSelectedOrder(await getOrder(orderId));
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

      {pending && <p role="status">Loading…</p>}
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
		                {order.status === "pending" && order.payment_status === "unpaid" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleCancelOrder(order.id)}
                >
                  Cancel order
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                aria-expanded={selectedOrder?.id === order.id}
                onClick={() => toggleOrderDetails(order.id)}
              >
                {selectedOrder?.id === order.id ? "Hide details" : "View details"}
              </button>

              {selectedOrder?.id === order.id && (
                <div>
                  {selectedOrder.items.length === 0 ? (
                    <p>No items recorded for this order.</p>
                  ) : (
                    <ul>
                      {selectedOrder.items.map((item) => (
                        <li key={item.id}>
                          <strong>{item.product_name}</strong>
                          <p>{item.color} · {item.size}</p>
                          <p>Quantity: {item.quantity}</p>
                          <p>Unit price: R{item.unit_price}</p>
                          <p>Line total: R{item.line_total}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
