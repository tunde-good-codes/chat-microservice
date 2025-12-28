import { randomUUID } from 'node:crypto';
import { getPrismaClient } from '@/clients/prisma.client';
import { Conversation, ConversationFilter, ConversationSummary, CreateConversationInput } from "../types/converation";

const toConversation = (c: any): Conversation => ({
  id: c.id,
  title: c.title,
  participantIds: c.participantIds,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  lastMessageAt: c.lastMessageAt,
  lastMessagePreview: c.lastMessagePreview,
});

export const conversationRepository = {
  async create(input: CreateConversationInput): Promise<Conversation> {
    const prisma = getPrismaClient();
    const now = new Date();

    const conversation = await prisma.conversation.create({
      data: {
        id: randomUUID(),
        title: input.title ?? null,
        participantIds: input.participantIds,
        createdAt: now,
        updatedAt: now,
      },
    });

    return toConversation(conversation);
  },

  async findById(id: string): Promise<Conversation | null> {
    const prisma = getPrismaClient();
    const convo = await prisma.conversation.findUnique({ where: { id } });
    return convo ? toConversation(convo) : null;
  },

  async findSummaries(filter: ConversationFilter): Promise<ConversationSummary[]> {
    const prisma = getPrismaClient();

    const conversations = await prisma.conversation.findMany({
      where: {
        participantIds: {
          has: filter.participantId,
        },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return conversations.map(toConversation);
  },

  async touchConversation(conversationId: string, preview: string): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        updatedAt: new Date(),
      },
    });
  },

  async removeAll(): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  },
};
