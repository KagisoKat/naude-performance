import { Router } from "express";
import { addItem, getCart } from "../controllers/cartController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfToken } from "../middleware/csrfProtection.js";
import { validateAddCartItem } from "../middleware/validateAddCartItem.js";

const router = Router();

router.get("/", requireAuth, getCart);

router.post(
    "/items",
    requireAuth,
    requireCsrfToken,
    validateAddCartItem,
    addItem
);

export default router;
