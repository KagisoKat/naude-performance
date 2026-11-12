import { Router } from "express";
import {
  addItem,
  getCart,
  removeItem,
  updateItem
} from "../controllers/cartController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfToken } from "../middleware/csrfProtection.js";
import {
  validateAddCartItem,
  validateCartItemId,
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
  validateCartItemId,
  validateUpdateCartItem,
  updateItem
);

router.delete(
  "/items/:itemId",
  requireAuth,
  requireCsrfToken,
  validateCartItemId,
  removeItem
);

export default router;