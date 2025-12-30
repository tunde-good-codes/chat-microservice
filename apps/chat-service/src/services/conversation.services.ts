

import { conversationCache } from "@/redis/conversation.cache";
import { conversationRepository } from "@/repositories/conversation.repository";
import { ValidationError } from "@shared/error-handler";
import { Conversation, ConversationFilter, ConversationSummary, CreateConversationInput } from "types/converation";

export const conversationService = {
  async createConversation(
    input: CreateConversationInput
  ): Promise<Conversation> {
    // Validate input
    if (!input.participantIds || input.participantIds.length === 0) {
      throw new ValidationError("At least one participant is required");
    }
    
    const conversation = await conversationRepository.create(input);
    
    // Don't cache immediately - wait for successful creation
    try {
      await conversationCache.set(conversation);
    } catch (cacheError) {
      console.warn('Failed to cache conversation:', cacheError);
      // Don't fail the request if caching fails
    }
    
    return conversation;
  },

  async getConversationById(id: string): Promise<Conversation> {
    // Try cache first
    const cached = await conversationCache.get(id);
    if (cached) {
      // Validate cached data
      if (!Array.isArray(cached.participantIds)) {
        // Cache is corrupted, delete it
        await conversationCache.delete(id);
      } else {
        return cached;
      }
    }
    
    // Fetch from database
    const conversation = await conversationRepository.findById(id);
    if (!conversation) {
      throw new ValidationError("Conversation not found");
    }

    // Cache the result
    try {
      await conversationCache.set(conversation);
    } catch (cacheError) {
      console.warn('Failed to cache conversation:', cacheError);
    }
    
    return conversation;
  },

  async listConversation(
    filter: ConversationFilter
  ): Promise<ConversationSummary[]> {
    return conversationRepository.findSummaries(filter);
  },

  async touchConversation(
    conversationId: string,
    preview: string
  ): Promise<void> {
    await conversationRepository.touchConversation(conversationId, preview);
    
    // Invalidate cache
    try {
      await conversationCache.delete(conversationId);
    } catch (cacheError) {
      console.warn('Failed to delete from cache:', cacheError);
    }
  },
};