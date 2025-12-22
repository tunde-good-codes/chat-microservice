import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import prisma from "@/database";
import crypto from "crypto";

const ACCESS_TOKEN: Secret = process.env.JWT_SECRET!;
const REFRESH_TOKEN: Secret = process.env.JWT_REFRESH_SECRET!;
const REFRESH_TOKEN_EXPIRES_IN = 7; // days

const ACCESS_OPTIONS: SignOptions = {
  expiresIn: process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
};
const REFRESH_OPTIONS: SignOptions = {
  expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
};

// ============= PASSWORD HASHING =============

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// ============= TYPE DEFINITIONS =============

export interface AccessTokenPayload {
  userId: string; // Changed to match your middleware
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tokenId: string;
}

// ============= ACCESS TOKEN =============

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN, ACCESS_OPTIONS);
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

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, ACCESS_TOKEN) as AccessTokenPayload;
};

// ============= REFRESH TOKEN =============

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN, REFRESH_OPTIONS);
};

/**
 * Generate and Store Refresh Token in Database
 */
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
  const expiresIn = REFRESH_TOKEN_EXPIRES_IN * 24 * 60 * 60; // 7 days in seconds

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

/**
 * Verify Refresh Token and return decoded payload
 */
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

// ============= TOKEN REVOCATION =============

/**
 * Revoke a specific refresh token by tokenId
 */
export const revokeRefreshToken = async (tokenId: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { tokenId },
  });
};

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};