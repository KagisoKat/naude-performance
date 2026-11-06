
import { Router } from "express";

import {
    register,
    login,
    logout,
    getCurrentUser
} from "../controllers/authController.js";

import { requireAuth } from "../middleware/requireAuth.js";

import { loginRateLimiter } from "../middleware/loginRateLimiter.js";

const router = Router();

router.post("/register", register);

router.post("/login", loginRateLimiter, login);

router.get("/me", requireAuth, getCurrentUser);

router.post("/logout", requireAuth, logout);

export default router;
