import { getOrderByIdForUser, getOrdersByUserId } from "../services/orderService.js";

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

const ORDER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrder(req, res, next) {
  const { orderId } = req.params;

  if (orderId.length !== 36 || !ORDER_ID_PATTERN.test(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Order ID must be a valid UUID"
    });
  }

  try {
    const order = await getOrderByIdForUser(orderId, req.user.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
}
