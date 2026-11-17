import { checkoutCart } from "../services/checkoutService.js";

export async function createOrder(req, res, next) {
  try {
    const result = await checkoutCart(req.user.id, req.shippingAddress);

    switch (result.outcome) {
      case "order_created":
        return res.status(201).json({
          success: true,
          order: result.order
        });

      case "empty_cart":
        return res.status(409).json({
          success: false,
          message: "Your cart is empty"
        });

      case "variant_unavailable":
        return res.status(409).json({
          success: false,
          message: "A cart item is no longer available",
          variantId: result.variantId
        });

      case "insufficient_stock":
        return res.status(409).json({
          success: false,
          message: "Not enough stock to check out",
          variantId: result.variantId,
          availableStock: result.availableStock
        });

      default:
        throw new Error(`Unexpected checkout outcome: ${result.outcome}`);
    }
  } catch (error) {
    next(error);
  }
}
