import { conversationRepository } from "@/repositories/conversation.repository";
import { conversationCache } from "@/redis/conversation.cache";
import { ValidationError } from "@shared/error-handler";

export const conversationService = {
  async createConversation(input:any) {
    const conversation = await conversationRepository.create(input);
    await conversationCache.set(conversation);
    return conversation;
  },

  async getConversationById(id: string) {
    const cached = await conversationCache.get(id);
    if (cached) return cached;

    const conversation = await conversationRepository.findById(id);
    if (!conversation) throw new ValidationError("Conversation not found");

    await conversationCache.set(conversation);
    return conversation;
  },

  async listConversation(filter:any) {
    return conversationRepository.findSummaries(filter);
  },

  async touchConversation(conversationId: string, preview: string) {
    await conversationRepository.touchConversation(conversationId, preview);
    await conversationCache.delete(conversationId);
  },
};
