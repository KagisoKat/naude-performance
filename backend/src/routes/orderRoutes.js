import { Router } from "express";
import { getOrder, getOrders } from "../controllers/orderController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, getOrders);
router.get("/:orderId", requireAuth, getOrder);

export default router;
