import { useState } from "react";
import ProductPicker from "./ProductPicker.jsx";
import {
	addCartItem,
  getCart,
  login,
  removeCartItem,
  updateCartItemQuantity
} from "./api.js";

export default function App() {
  const [cart, setCart] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);

    setPending(true);
    setError("");

    try {
      if (!signedIn) {
        await login(fields.get("email"), fields.get("password"));
        form.reset();
        setSignedIn(true);
      }

      setCart(await getCart());
    } catch (error) {
      if (error.status === 401) {
        setSignedIn(false);
      }
      setError(error.message);
    } finally {
      setPending(false);
    }
  }

  async function handleQuantityUpdate(event, itemId) {
    event.preventDefault();

    const fields = new FormData(event.currentTarget);
    const quantity = Number(fields.get("quantity"));

    setPending(true);
    setError("");

    try {
      await updateCartItemQuantity(itemId, quantity);
      setCart(await getCart());
    } catch (error) {
      if (error.status === 401) {
        setCart(null);
        setSignedIn(false);
      }
      setError(error.message);
    } finally {
      setPending(false);
    }
  }

	  async function handleAddToCart(variantId) {
    setPending(true);
    setError("");

    try {
      await addCartItem(variantId, 1);
      setCart(await getCart());
    } catch (error) {
      if (error.status === 401) {
        setCart(null);
        setSignedIn(false);
      }
      setError(error.message);
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(itemId) {
    setPending(true);
    setError("");

    try {
      await removeCartItem(itemId);
      setCart(await getCart());
    } catch (error) {
      if (error.status === 401) {
        setCart(null);
        setSignedIn(false);
      }
      setError(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <h1>NAUDÉ Shopping Cart</h1>

      {cart ? (
        <section aria-label="Cart summary">
	                          <ProductPicker onAdd={handleAddToCart} cartPending={pending} />
          {cart.items.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            <ul>
              {cart.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.productName}</strong>
                  <p>{item.color} · {item.size}</p>
                  <p>Quantity: {item.quantity}</p>

                  <form onSubmit={(event) => handleQuantityUpdate(event, item.id)}>
                    <label htmlFor={`quantity-${item.id}`}>
                      New quantity
                    </label>{" "}
                    <input
                      key={item.quantity}
                      id={`quantity-${item.id}`}
                      name="quantity"
                      type="number"
                      min="1"
                      max="2147483647"
                      step="1"
                      defaultValue={item.quantity}
                      disabled={pending}
                      required
                    />{" "}
                    <button type="submit" disabled={pending}>
                      Update
                    </button>
                  </form>

		                        <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleRemove(item.id)}
                  >
                    Remove
                  </button>

                  <p>Line total: R{item.lineTotal}</p>
                  {!item.isAvailable && <p>Unavailable at this quantity</p>}
                </li>
              ))}
            </ul>
          )}
          <p>Items: {cart.itemCount}</p>
          <p>Subtotal: R{cart.subtotal}</p>
        </section>
      ) : (
        <form onSubmit={handleSubmit}>
          <fieldset disabled={pending}>
            <legend>{signedIn ? "Your cart" : "Customer sign-in"}</legend>

            {!signedIn && (
              <>
                <p>
                  <label htmlFor="email">Email</label>{" "}
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                  />
                </p>
                <p>
                  <label htmlFor="password">Password</label>{" "}
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </p>
              </>
            )}

            <button type="submit">
              {pending ? "Please wait…" : signedIn ? "Retry loading cart" : "Sign in"}
            </button>
          </fieldset>
        </form>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
