export default function CheckoutForm({ onCheckout, pending }) {
  function handleSubmit(event) {
    event.preventDefault();

    if (pending) return;

    const fields = new FormData(event.currentTarget);

    const shippingAddress = {
      line1: String(fields.get("line1") ?? "").trim(),
      city: String(fields.get("city") ?? "").trim(),
      province: String(fields.get("province") ?? "").trim(),
      postalCode: String(fields.get("postalCode") ?? "").trim()
    };

    const line2 = String(fields.get("line2") ?? "").trim();

    if (line2) {
      shippingAddress.line2 = line2;
    }

    onCheckout(shippingAddress);
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={pending}>
        <legend>Shipping address</legend>

        <p>
          <label htmlFor="checkout-line1">Address line 1</label>
          <input
            id="checkout-line1"
            name="line1"
            maxLength={200}
            autoComplete="address-line1"
            required
          />
        </p>

        <p>
          <label htmlFor="checkout-line2">
            Address line 2 (optional)
          </label>
          <input
            id="checkout-line2"
            name="line2"
            maxLength={200}
            autoComplete="address-line2"
          />
        </p>

        <p>
          <label htmlFor="checkout-city">City</label>
          <input
            id="checkout-city"
            name="city"
            maxLength={100}
            autoComplete="address-level2"
            required
          />
        </p>

        <p>
          <label htmlFor="checkout-province">Province</label>
          <input
            id="checkout-province"
            name="province"
            maxLength={100}
            autoComplete="address-level1"
            required
          />
        </p>

        <p>
          <label htmlFor="checkout-postal-code">
            Postal code
          </label>
          <input
            id="checkout-postal-code"
            name="postalCode"
            maxLength={20}
            autoComplete="postal-code"
            required
          />
        </p>

        <button type="submit" disabled={pending}>
          {pending ? "Placing order..." : "Place order"}
        </button>
      </fieldset>
    </form>
  );
}
