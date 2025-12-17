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
} from "@/utils/tokens";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";

import {
  ForbiddenError,
  InternalServerError,
  ValidationError,
} from "@shared/error-handler";
import e, { Request, Response, NextFunction } from "express";
import { loginSchema, registerSchema } from "@/validation";
import { publishUserRegistered } from "@/utils/messaging/event-publishing";

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

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: true });

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

  const isPasswordMatched = verifyPassword(password, user?.password!);
  if (!isPasswordMatched) {
    res.status(409).json({
      success: false,
      message: "Invalid email or password",
    });
    return;
  }

  const { password: _, ...userData } = user;

  const refreshToken = await createRefreshToken(user?.id!);
  const accessToken = generateAccessToken(user?.id!, user?.email!);
  return res.status(200).json({
    success: true,
    message: "login successfully",
    data: {
      userData,
      accessToken,
      refreshToken,
    },
  });
};

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
  } catch (error:any) {
    res.status(500).json({ message: "Internal server error: " + error.message });
  }
};
