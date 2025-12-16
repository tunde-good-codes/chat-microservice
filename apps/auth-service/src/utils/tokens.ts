
import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

const ACCESS_TOKEN: Secret = process.env.JWT_SECRET!;
const REFRESH_TOKEN: Secret = process.env.JWT_REFRESH_SECRET!;

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

export const verifyRefreshToken = (payload: string): RefreshTokenPayload => {
  return jwt.verify(payload, REFRESH_TOKEN) as RefreshTokenPayload;
};
