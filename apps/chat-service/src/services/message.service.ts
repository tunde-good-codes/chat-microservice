import { messageRepository } from "@/repositories/message.repository";
import { conversationService } from "./conversation.services";
import { ValidationError } from "@shared/error-handler";
import { Message, MessageListOptions } from "types/message";

export const messageService = {
  async createMessage(
    conversationId: string,
    senderId: string,
    body: string
  ): Promise<Message> {
    // Ensure conversation exists before inserting the message
    const conversation = await conversationService.getConversationById(
      conversationId
    );

    if (!conversation.participantIds.includes(senderId)) {
      throw new ValidationError("Sender is not part of this conversation");
    }

    const message = await messageRepository.create(
      conversationId,
      senderId,
      body
    );
    await conversationService.touchConversation(
      conversationId,
      body.slice(0, 120)
    );

    return message;
  },

  async listMessages(
    conversationId: string,
    requesterId: string,
    options: MessageListOptions = {}
  ): Promise<Message[]> {
    // Ensure conversation exists; re-use conversation service for caching behavior
    const conversation = await conversationService.getConversationById(
      conversationId
    );

    if (!conversation.participantIds.includes(requesterId)) {
      throw new ValidationError("Requester is not part of this conversation");
    }

    return messageRepository.findByConversation(conversationId, options);
  },
};
