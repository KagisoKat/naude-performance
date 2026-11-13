import { useState } from "react";
import { getProduct, getProducts } from "./api.js";

export default function ProductPicker({ onAdd, cartPending }) {
  const [products, setProducts] = useState(null);
  const [product, setProduct] = useState(null);
  const [slug, setSlug] = useState("");
  const [variantId, setVariantId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function loadProducts() {
    setPending(true);
    setError("");

    try {
      setProducts(await getProducts());
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }

  async function selectProduct(event) {
    const selectedSlug = event.target.value;

    setSlug(selectedSlug);
    setProduct(null);
    setVariantId("");
    setError("");

    if (!selectedSlug) {
      return;
    }

    setPending(true);

    try {
      setProduct(await getProduct(selectedSlug));
    } catch (error) {
      setSlug("");
      setError(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="product-picker-heading">
      <h2 id="product-picker-heading">Shop products</h2>

      {products === null ? (
        <button type="button" onClick={loadProducts} disabled={pending}>
          Browse products
        </button>
      ) : products.length === 0 ? (
        <p>No products are available.</p>
      ) : (
        <p>
          <label htmlFor="cart-product">Product</label>{" "}
          <select
            id="cart-product"
            value={slug}
            onChange={selectProduct}
            disabled={pending}
          >
            <option value="">Choose a product</option>
            {products.map((entry) => (
              <option key={entry.id} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </p>
      )}

      {product && (
        <p>
          <label htmlFor="cart-variant">Colour and size</label>{" "}
          <select
            id="cart-variant"
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
          >
            <option value="">Choose a variant</option>
            {product.variants.map((variant) => (
              <option
                key={variant.id}
                value={variant.id}
                disabled={!variant.in_stock}
              >
                {variant.color} / {variant.size} · R{variant.price}
                {!variant.in_stock && " · Out of stock"}
              </option>
            ))}
          </select>
        </p>
      )}

	        {product && (
        <button
          type="button"
          disabled={!variantId || pending || cartPending}
          onClick={() => onAdd(variantId)}
        >
          Add to cart
        </button>
      )}

      {pending && <p role="status">Loading…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
