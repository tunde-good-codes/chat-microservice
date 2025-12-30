import prisma from "@/database";
import { Prisma } from "@/generated/client";
import { Conversation, ConversationFilter, CreateConversationInput } from "types/converation";

type ConversationWithParticipants =
  Prisma.ConversationGetPayload<{
    include: { participants: { select: { id: true } } };
  }>;

const toConversation = (c: ConversationWithParticipants): Conversation => ({
  id: c.id,
  title: c.title,
  participantIds: c.participants.map((p) => p.id),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  lastMessageAt: c.lastMessageAt,
  lastMessagePreview: c.lastMessagePreview,
});

export const conversationRepository = {
  async create(input: CreateConversationInput): Promise<Conversation> {
    const conversation = await prisma.conversation.create({
      data: {
        title: input.title ?? null,
        participants: {
          connect: input.participantIds.map((id) => ({ id })),
        },
      },
      include: {
        participants: { select: { id: true } },
      },
    });

    return toConversation(conversation);
  },

  async findById(id: string): Promise<Conversation | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: { select: { id: true } },
      },
    });

    return conversation ? toConversation(conversation) : null;
  },

  async findSummaries(filter: ConversationFilter): Promise<Conversation[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: filter.participantId },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      include: {
        participants: { select: { id: true } },
      },
    });

    return conversations.map(toConversation);
  },

  async touchConversation(conversationId: string, preview: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
      },
    });
  },
};
