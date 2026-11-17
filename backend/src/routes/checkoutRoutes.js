import { Router } from "express";
import { createOrder } from "../controllers/checkoutController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfToken } from "../middleware/csrfProtection.js";
import { validateCheckout } from "../middleware/validateCheckout.js";

const router = Router();

router.post("/", requireAuth, requireCsrfToken, validateCheckout, createOrder);

export default router;
