
import { Router } from "express";

import {
    register,
    login,
    logout,
    getCurrentUser
} from "../controllers/authController.js";

import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/register", register);

router.post("/login", login);

router.get("/me", requireAuth, getCurrentUser);

router.post("/logout", requireAuth, logout);

export default router;
