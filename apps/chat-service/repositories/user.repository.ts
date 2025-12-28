import type { UserCreatedPayload } from '@chatapp/common';
import { getPrismaClient } from '@/clients/prisma.client';

export const userRepository = {
  async upsertUser(payload: UserCreatedPayload) {
    const prisma = getPrismaClient();

    await prisma.user.upsert({
      where: { id: payload.id },
      update: {
        email: payload.email,
        displayName: payload.displayName,
        updatedAt: new Date(payload.updatedAt),
      },
      create: {
        id: payload.id,
        email: payload.email,
        displayName: payload.displayName,
        createdAt: new Date(payload.createdAt),
        updatedAt: new Date(payload.updatedAt),
      },
    });
  },

  async findUserById(id: string) {
    const prisma = getPrismaClient();
    return prisma.user.findUnique({ where: { id } });
  },
};
