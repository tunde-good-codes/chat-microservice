import prisma from "@/database";
import { Message, MessageListOptions } from "types/message";

const toMessage = (m: any): Message => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  body: m.body,
  createdAt: m.createdAt,
  reactions: m.reactions ?? [],
});

export const messageRepository = {
  async create(conversationId: string, senderId: string, body: string): Promise<Message> {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        body,
      },
    });

    return toMessage(message);
  },

  async findByConversation(
    conversationId: string,
    options: MessageListOptions = {},
  ): Promise<Message[]> {
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        createdAt: options.after ? { gt: options.after } : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
    });

    return messages.map(toMessage);
  },
};
