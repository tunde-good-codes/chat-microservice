import prisma from "@/database";
import { AuthResponse, RegisterInput, UsualResponse } from "@/types";
import { hashPassword } from "@/utils/tokens";
import {
  ForbiddenError,
  InternalServerError,
  ValidationError,
} from "@shared/error-handler";
import { Request, Response, NextFunction } from "express";

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<UsualResponse | void> => {
  try {
    const { email, displayName, password } = req.body as RegisterInput;

    // Validation
    if (!email || !displayName || !password) {
      res.status(400).json({
        success: false,
        message: "All fields are required",
      });
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
