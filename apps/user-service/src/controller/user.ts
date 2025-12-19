import prisma from "@/database";
import { NextFunction, Request, Response } from "express";

interface AuthUserRegisterPayload {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}
export const findUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  if (!id) {
    return res.status(409).json({
      success: false,
      message: "no id provided",
    });
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      updatedAt: true,
      displayName: true,
    },
  });
  if (!user) {
    return res.status(409).json({
      success: false,
      message: "no user found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "user fetched!",
    user,
  });
};

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      updatedAt: true,
      displayName: true,
    },
  });

  if (!users) {
    return res.status(409).json({
      success: false,
      message: "no user found",
    });
  }
  return res.status(200).json({
    success: true,
    message: "user fetched!",
    users,
  });
};

export const upsertFromAuthEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
  payload: AuthUserRegisterPayload
) => {
  await prisma.user.upsert({
    where: {
      id: payload.id, // ✅ UNIQUE FIELD GOES HERE
    },
    create: {
      id: payload.id,
      email: payload.email,
      displayName: payload.displayName,
      createdAt: new Date(payload.createdAt),
    },
    update: {
      email: payload.email,
      displayName: payload.displayName,
      updatedAt: new Date(payload.createdAt),
    },
  });
};
