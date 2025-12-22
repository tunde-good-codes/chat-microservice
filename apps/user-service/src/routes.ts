import { isAuthenticated } from "../../auth-service/src/middleware/isAuth";
import { authenticateToken, validateRequest } from "../../../shared/middleware";
import { Router } from "express";
import { createUser, findUserById, getAllUsers, updateUserProfile } from "./userController";
const router = Router();

// Protected routes (requires authentication)
router.post("/", isAuthenticated, createUser);
router.get("/", isAuthenticated, getAllUsers);
router.get("/:id", isAuthenticated, findUserById);
router.put("/user-profile/:id", isAuthenticated,  updateUserProfile);

export default router;
