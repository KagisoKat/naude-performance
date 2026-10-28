
import { Router } from "express";

import {
  getProducts,
  getProduct
} from "../controllers/productController.js";

const router = Router();

router.get("/", getProducts);

router.get("/:slug", getProduct);

export default router;

