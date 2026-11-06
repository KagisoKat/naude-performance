
import { Router } from "express";

import {
    register,
    login,
    logout,
    getCurrentUser,
    getCsrfToken
} from "../controllers/authController.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { loginRateLimiter } from "../middleware/loginRateLimiter.js";
import { requireCsrfToken } from "../middleware/csrfProtection.js";

const router = Router();

router.post("/register", register);

router.post("/login", loginRateLimiter, login);

router.get("/me", requireAuth, getCurrentUser);

router.get(
    "/csrf-token",
    requireAuth,
    getCsrfToken
);

router.post(
    "/logout",
    requireAuth,
    requireCsrfToken,
    logout
);

export default router;
