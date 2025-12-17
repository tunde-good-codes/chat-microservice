import prisma from "@/database";
import { AuthResponse, RegisterInput, UsualResponse } from "@/types";
import { hashPassword } from "@/utils/tokens";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";

import {
  ForbiddenError,
  InternalServerError,
  ValidationError,
} from "@shared/error-handler";
import { Request, Response, NextFunction } from "express";
const REFRESH_TOKEN_EXPIRES_IN = 30;

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, displayName, password } = req.body as RegisterInput;

    // Validation
    if (!email || !displayName || !password) {
      res.status(400).json({
        success: false,
        message: "All fields are required",
      });
      return; // Stop execution here
    }

    // Check existing email
    const existingEmail = await prisma.userCredentials.findUnique({
      where: { email },
    });

    if (existingEmail) {
      res.status(409).json({
        // ✅ 409 Conflict is better than 400
        success: false,
        message: "Email already registered",
      });
      return; // Stop execution here
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
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
    res.status(201).json({
      success: true,
      message: "Registration successful. Please log in to continue.",
      user,
    });
  } catch (e: any) {
    next(e);
  }
};

export const generateAccessToken = (userId: string, email: string): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  // Use number format (seconds) instead of string
  const expiresIn = 15 * 60; // 15 minutes in seconds

  return jwt.sign({ userId, email, type: "access" }, secret, { expiresIn });
};

// Generate and Store Refresh Token
export const createRefreshToken = async (
  userId: string
): Promise<{
  token: string;
  tokenId: string;
  expiresAt: Date;
}> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN);
  const tokenId = crypto.randomUUID();
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error("REFRESH_SECRET environment variable is not set");
  }

  // Use number format (seconds) instead of string
  const expiresIn = 7 * 24 * 60 * 60; // 604,800 seconds
  // 15 minutes in seconds
  // Store in database
  await prisma.refreshToken.create({
    data: {
      tokenId,
      userId,
      expiresAt,
    },
  });
  const token = jwt.sign({ userId, tokenId, type: "refresh" }, secret, {
    expiresIn,
  });

  return {
    token,
    tokenId,
    expiresAt,
  };
};

// Verify Refresh Token
export const verifyRefreshToken = async (
  token: string
): Promise<{ userId: string; tokenId: string } | null> => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      tokenId: string;
      type: string;
    };

    if (decoded.type !== "refresh") {
      return null;
    }

    // Check if token exists in database and is not expired
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        tokenId: decoded.tokenId,
        userId: decoded.userId,
        expiresAt: {
          gt: new Date(), // greater than current date
        },
      },
    });

    if (!tokenRecord) {
      return null;
    }

    return {
      userId: decoded.userId,
      tokenId: decoded.tokenId,
    };
  } catch (error) {
    return null;
  }
};

// ✅ Now this will work
export const revokeRefreshToken = async (tokenId: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { tokenId },
  });
};

// Revoke All User Refresh Tokens
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};
