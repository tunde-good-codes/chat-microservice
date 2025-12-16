import prisma from "@/database";
import { AuthResponse, RegisterInput } from "@/types";
import { ValidationError } from "@shared/error-handler";
import { Request, Response, NextFunction } from "express";

const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<AuthResponse> => {
  const { email, displayName, password } = req.body as RegisterInput;

  if (!email || !displayName || !password) {
    res.status(400).json({
      success: false,
      message: "all fields are required",
    });
    throw new ValidationError("All the fields are required!");
  }
  const existingEmail = await prisma.
};
