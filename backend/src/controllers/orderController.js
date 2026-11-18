import { getOrdersByUserId } from "../services/orderService.js";

export async function getOrders(req, res, next) {
  try {
    const orders = await getOrdersByUserId(req.user.id);

    return res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    next(error);
  }
}
