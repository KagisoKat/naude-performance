import {
  addCartItem,
  getCartByUserId,
  updateCartItemQuantity
} from "../services/cartService.js";

export async function getCart(req, res, next) {
  try {
    const cart = await getCartByUserId(req.user.id);

    return res.status(200).json({
      success: true,
      cart
    });
  } catch (error) {
    next(error);
  }
}

export async function addItem(req, res, next) {
  try {
    const { variantId, quantity } = req.body;
    const result = await addCartItem(req.user.id, variantId, quantity);

    if (result.outcome === "variant_unavailable") {
      return res.status(404).json({
        success: false,
        message: "Product variant not available"
      });
    }

    if (result.outcome === "insufficient_stock") {
      return res.status(409).json({
        success: false,
        message: "Not enough stock to add this quantity",
        availableStock: result.availableStock
      });
    }

    return res.status(200).json({
      success: true,
      item: result.item
    });
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req, res, next) {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const result = await updateCartItemQuantity(req.user.id, itemId, quantity);

    if (result.outcome === "item_not_found") {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    if (result.outcome === "variant_unavailable") {
      return res.status(404).json({
        success: false,
        message: "Product variant not available"
      });
    }

    if (result.outcome === "insufficient_stock") {
      return res.status(409).json({
        success: false,
        message: "Not enough stock to set this quantity",
        availableStock: result.availableStock
      });
    }

    return res.status(200).json({
      success: true,
      item: result.item
    });
  } catch (error) {
    next(error);
  }
}
