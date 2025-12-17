
import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import prisma from "@/database";

const ACCESS_TOKEN: Secret = process.env.JWT_SECRET!;
const REFRESH_TOKEN: Secret = process.env.JWT_REFRESH_SECRET!;
const REFRESH_TOKEN_EXPIRES_IN = 7;

const ACCESS_OPTIONS: SignOptions = {
  expiresIn: process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
};
const REFRESH_OPTIONS: SignOptions = {
  expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
};

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tokenId: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN, ACCESS_OPTIONS);
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN, REFRESH_OPTIONS);
};

// export const verifyRefreshToken = (payload: string): RefreshTokenPayload => {
//   return jwt.verify(payload, REFRESH_TOKEN) as RefreshTokenPayload;
// };






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