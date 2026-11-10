
import { getCartByUserId } from "../services/cartService.js";

export async function getCart(req, res, next) {
  try {
    const userId = req.user.id;

    const cart = await getCartByUserId(userId);

    return res.status(200).json({
      success: true,
      cart
    });
  } catch (error) {
    next(error);
  }
}
