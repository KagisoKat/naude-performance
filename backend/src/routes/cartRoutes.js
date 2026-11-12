import { Router } from "express";
import { addItem, getCart, updateItem } from "../controllers/cartController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfToken } from "../middleware/csrfProtection.js";
import {
  validateAddCartItem,
  validateUpdateCartItem
} from "../middleware/validateAddCartItem.js";

const router = Router();

router.get("/", requireAuth, getCart);

router.post(
    "/items",
    requireAuth,
    requireCsrfToken,
    validateAddCartItem,
    addItem
);

router.patch(
  "/items/:itemId",
  requireAuth,
  requireCsrfToken,
  validateUpdateCartItem,
  updateItem
);

export default router;
