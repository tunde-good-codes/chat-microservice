import prisma from "@/database";
import {
  AuthResponse,
  LoginInput,
  RegisterInput,
  UsualResponse,
} from "@/types";
import {
  createRefreshToken,
  generateAccessToken,
  hashPassword,
  verifyPassword,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from "@/utils/tokens";

import {
  ForbiddenError,
  InternalServerError,
  ValidationError,
} from "@shared/error-handler";
import { Request, Response, NextFunction } from "express";
import { loginSchema, registerSchema } from "@/validation";
import { publishUserRegistered } from "@/utils/messaging/event-publishing";

// ============= REGISTRATION =============

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = registerSchema.validate(req.body, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }

    const { email, displayName, password } = value as RegisterInput;

    const existingEmail = await prisma.userCredentials.findUnique({
      where: { email },
    });

    if (existingEmail) {
      res.status(409).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.userCredentials.create({
      data: {
        email,
        displayName,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    const userData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };

    publishUserRegistered(userData);
    res.status(201).json({
      success: true,
      message: "Registration successful. Please log in to continue.",
      user,
    });
  } catch (e: any) {
    next(e);
  }
};

// ============= LOGIN =============

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }

    const { email, password } = value as LoginInput;

    if (!email) {
      res.status(409).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const user = await prisma.userCredentials.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const isPasswordMatched = await verifyPassword(password, user.password);
    if (!isPasswordMatched) {
      res.status(409).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const { password: _, ...userData } = user;

    // Create refresh token and store in DB
    const refreshTokenData = await createRefreshToken(user.id);
    const accessToken = generateAccessToken(user.id, user.email);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        userData,
        accessToken,
        refreshToken: refreshTokenData.token,
      },
    });
  } catch (e: any) {
    next(e);
  }
};

// ============= GET USER PROFILE =============

export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // req.user was set by the isAuthenticated middleware
    const { userId } = req.user;

    const user = await prisma.userCredentials.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Internal server error: " + error.message });
  }
};

// ============= REFRESH TOKENS =============

export const refreshTokens = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    // Verify the refresh token
    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
      return;
    }

    // Find the user
    const user = await prisma.userCredentials.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      console.warn(`User missing for refresh token: ${payload.userId}`);
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
      return;
    }

    // Revoke the old refresh token
    await revokeRefreshToken(payload.tokenId);

    // Create new refresh token
    const newRefreshTokenData = await createRefreshToken(user.id);
    const newAccessToken = generateAccessToken(user.id, user.email);

    res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenData.token,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// ============= LOGOUT =============

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (payload) {
      // Delete the specific refresh token
      await revokeRefreshToken(payload.tokenId);
    }

    // Return success even if token was invalid
    // because the goal (logout) is achieved
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

// ============= REVOKE ALL SESSIONS =============

export const revokeAllSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user; // From authentication middleware

    await revokeAllUserTokens(userId);

    res.status(200).json({
      success: true,
      message: "All sessions revoked successfully",
    });
  } catch (error: any) {
    next(error);
  }
};