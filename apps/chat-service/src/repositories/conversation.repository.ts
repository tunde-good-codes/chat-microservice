import prisma from "@/database";
import { Conversation, ConversationFilter, ConversationSummary, CreateConversationInput } from "types/converation";


// Fix the transformation function
const toConversation = (conversation: any): Conversation => ({
  id: conversation.id,
  title: conversation.title,
  participantIds: conversation.participants.map((p: any) => p.id), // This should be userId, not id
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
  lastMessageAt: conversation.lastMessageAt,
  lastMessagePreview: conversation.lastMessagePreview,
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
        participants: {
          select: {
            id: true, // This returns the User's id
          },
        },
      },
    });

    return toConversation(conversation);
  },

  async findById(id: string): Promise<Conversation | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          select: {
            id: true, // Ensure we get user IDs
          },
        },
      },
    });

    return conversation ? toConversation(conversation) : null;
  },

  async findSummaries(
    filter: ConversationFilter
  ): Promise<ConversationSummary[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            id: filter.participantId,
          },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      include: {
        participants: {
          select: {
            id: true,
          },
        },
      },
    });

    return conversations.map(toConversation);
  },

  async touchConversation(
    conversationId: string,
    preview: string
  ): Promise<void> {
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
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
  },
};