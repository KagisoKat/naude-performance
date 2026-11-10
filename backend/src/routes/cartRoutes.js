
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getCart } from "../controllers/cartController.js";

const router = Router();

router.get("/", requireAuth, getCart);

export default router;
