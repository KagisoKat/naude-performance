import { Router } from "express";
import { getOrders } from "../controllers/orderController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, getOrders);

export default router;
