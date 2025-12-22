import { CreateUserInput } from "./../types";
import prisma from "@/database";
import { NextFunction, Request, Response } from "express";
import { AuthUserRegisteredPayload } from "@shared/types/events/auth-events";
import { publishUserCreatedEvent } from "./utils/messaging/event-publisher";
import { createUserProfileSchema } from "./validation";

export const findUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "No id provided",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      count: users.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync user from auth service registration event
 * This is called by the RabbitMQ consumer, not via HTTP
 */
export const syncFromAuthUser = async (
  payload: AuthUserRegisteredPayload
): Promise<void> => {
  try {
    // Upsert: create if doesn't exist, update if exists
    const user = await prisma.user.upsert({
      where: { id: payload.id as string },
      update: {
        email: payload.email,
        displayName: payload.displayName,
        updatedAt: new Date(),
      },
      create: {
        id: payload.id as string,
        email: payload.email,
        displayName: payload.displayName,
      },
    });

    console.log(`✅ User synced from auth: ${user.email}`);

    // Publish user.created event for other services
    await publishUserCreatedEvent({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("❌ Error syncing user from auth:", error);
    throw error; // Re-throw so RabbitMQ can handle retry/nack
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { displayName } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "No id provided",
      });
    }

    if (!displayName) {
      res.status(400).json({
        success: false,
        message: "Display name is required",
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        displayName,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error, value } = createUserProfileSchema.validate(req.body, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }
    const { email, displayName } = value as CreateUserInput;

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
      },
    });

    await publishUserCreatedEvent({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

    res.status(201).json({
      success: true,
      message: "user created successfully!",
      user,
    });
  } catch (e) {
    next(e);
  }
};
