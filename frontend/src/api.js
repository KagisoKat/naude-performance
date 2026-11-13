const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://192.168.56.10:5000";

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include"
  });


	  if (response.status === 204) {
    return;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message ?? "The request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getHealth() {
  return requestJson("/api/health");
}

export async function getCart() {
  const { cart } = await requestJson("/api/cart");
  return cart;
}

export function login(email, password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function updateCartItemQuantity(itemId, quantity) {
  const { csrfToken } = await requestJson("/api/auth/csrf-token");

  const { item } = await requestJson(
    `/api/cart/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({ quantity })
    }
  );

  return item;
}

export async function removeCartItem(itemId) {
  const { csrfToken } = await requestJson("/api/auth/csrf-token");

  await requestJson(`/api/cart/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: { "X-CSRF-Token": csrfToken }
  });
}

export async function getProducts() {
  const { data } = await requestJson("/api/products");
  return data;
}

export async function getProduct(slug) {
  const { data } = await requestJson(
    `/api/products/${encodeURIComponent(slug)}`
  );
  return data;
}

export async function addCartItem(variantId, quantity) {
  const { csrfToken } = await requestJson("/api/auth/csrf-token");

  const { item } = await requestJson("/api/cart/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({ variantId, quantity })
  });

  return item;
}
