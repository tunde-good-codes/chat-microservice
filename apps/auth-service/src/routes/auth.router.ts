import { getUserProfile, loginUser, registerUser } from "@/controllers/auth.controller"
import { isAuthenticated } from "@/middleware/isAuth"
import express from "express"
const router = express.Router()

router.post("/register", registerUser)
router.post("/login", loginUser)
router.get("/user-profile", isAuthenticated, getUserProfile);

export default router;
