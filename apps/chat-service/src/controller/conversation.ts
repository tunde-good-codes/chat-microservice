import { conversationService } from "@/services/conversation.services";
import { messageService } from "@/services/message.service";
import {
  conversationIdParamsSchema,
  createConversationSchema,
  createMessageBodySchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
} from "@/validation";
import {  ValidationError } from "@shared/error-handler";
import type { RequestHandler, Request, Response, NextFunction } from "express";


export const createConversationHandler: RequestHandler = async (req, res) => {
  const { userId } = req.user;

  const { title, participantIds } =
    await createConversationSchema.validateAsync(req.body);

  const uniqueParticipantIds = Array.from(
    new Set([...participantIds, userId]),
  );

  if (uniqueParticipantIds.length < 2) {
    throw new ValidationError(
      "Conversation must include at least one other participant",
    );
  }

  const conversation = await conversationService.createConversation({
    title,
    participantIds: uniqueParticipantIds,
  });

  res.status(201).json({ data: conversation });
};

export const listConversationHandler: RequestHandler = async (req, res) => {
  const { userId } = req.user;

  const { participantId } =
    await listConversationsQuerySchema.validateAsync(req.query);

  if (participantId && participantId !== userId) {
    throw new ValidationError("Unauthorized");
  }

  const conversations = await conversationService.listConversation({
    participantId: userId,
  });

  res.json({ data: conversations });
};
export const getConversationHandler: RequestHandler = async (req, res) => {
  const { userId } = req.user;

  const { id } =
    await conversationIdParamsSchema.validateAsync(req.params);

  const conversation = await conversationService.getConversationById(id);

  if (!conversation.participantIds.includes(userId)) {
    throw new ValidationError("Unauthorized");
  }

  res.json({ data: conversation });
};

export const createMessageHandler: RequestHandler = async (req, res) => {
  const { userId } = req.user;

  const { id: conversationId } =
    await conversationIdParamsSchema.validateAsync(req.params);

  const { body } =
    await createMessageBodySchema.validateAsync(req.body);

  const message = await messageService.createMessage(
    conversationId,
    userId,
    body,
  );

  res.status(201).json({ data: message });
};


export const listMessageHandler: RequestHandler = async (req, res) => {
  const { userId } = req.user;

  const { id: conversationId } =
    await conversationIdParamsSchema.validateAsync(req.params);

  const { limit, after } =
    await listMessagesQuerySchema.validateAsync(req.query);

  const messages = await messageService.listMessages(
    conversationId,
    userId,
    {
      limit,
      after: after ? new Date(after) : undefined,
    },
  );

  res.json({ data: messages });
};
