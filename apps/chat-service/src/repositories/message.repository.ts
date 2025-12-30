import { randomUUID } from 'node:crypto';
import {Message, MessageListOptions} from "../../types/message" 
import prisma from "@/database";
const toMessage = (msg: any): Message => ({
  id: msg.id,
  conversationId: msg.conversationId,
  senderId: msg.senderId,
  body: msg.body,
  createdAt: msg.createdAt,
  reactions: msg.reactions?.map((r: any) => ({
    emoji: r.emoji,
    userId: r.userId,
    createdAt: r.createdAt,
  })) ?? [],
});

export const messageRepository = {
  async create(conversationId: string, senderId: string, body: string): Promise<Message> {

    const message = await prisma.message.create({
      data: {
        id: randomUUID(),
        conversationId,
        senderId,
        body,
        createdAt: new Date(),
      },
      // include: { reactions: true },
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
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      // include: { reactions: true },
    });

    return messages.map(toMessage);
  },

  async findById(messageId: string): Promise<Message | null> {

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      // include: { reactions: true },
    });

    return message ? toMessage(message) : null;
  },
};
