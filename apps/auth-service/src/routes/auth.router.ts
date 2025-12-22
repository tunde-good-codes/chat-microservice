import { Router } from "express";

import { isAuthenticated } from "@/middleware/isAuth";
import { getUserProfile, loginUser, logout, refreshTokens, registerUser, revokeAllSessions } from "@/controllers/auth.controller";

const router = Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshTokens);
router.post("/logout", logout);

// Protected routes (require authentication)
router.get("/profile", isAuthenticated, getUserProfile);
router.post("/revoke-all", isAuthenticated, revokeAllSessions);

export default router;