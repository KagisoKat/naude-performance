import { Router } from "express";
import {
  cancelOrder,
  getOrder,
  getOrders
} from "../controllers/orderController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfToken } from "../middleware/csrfProtection.js";

const router = Router();

router.get("/", requireAuth, getOrders);
router.get("/:orderId", requireAuth, getOrder);

router.post(
  "/:orderId/cancel",
  requireAuth,
  requireCsrfToken,
  cancelOrder
);

export default router;
