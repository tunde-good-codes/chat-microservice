import { Conversation } from "types/converation";
import { getRedisClient } from "./redis.client";


const CACHE_PREFIX = 'conversation:';
const CACHE_TTL_SECONDS = 60;

const serialize = (conversation: Conversation): string => {
  return JSON.stringify({
    ...conversation,
    participantIds: conversation.participantIds || [], // Ensure array exists
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt?.toISOString() || null,
  });
};

const deserialize = (raw: string): Conversation => {
  const parsed = JSON.parse(raw);
  
  // Ensure participantIds is always an array
  const participantIds = Array.isArray(parsed.participantIds) 
    ? parsed.participantIds 
    : [];
  
  return {
    ...parsed,
    participantIds,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
    lastMessageAt: parsed.lastMessageAt ? new Date(parsed.lastMessageAt) : null,
  };
};

export const conversationCache = {
  async get(conversationId: string): Promise<Conversation | null> {
    try {
      const redis = getRedisClient();
      const payload = await redis.get(`${CACHE_PREFIX}${conversationId}`);
      return payload ? deserialize(payload) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async set(conversation: Conversation): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(
        `${CACHE_PREFIX}${conversation.id}`,
        CACHE_TTL_SECONDS,
        serialize(conversation),
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async delete(conversationId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`${CACHE_PREFIX}${conversationId}`);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },
};