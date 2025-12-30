import { conversationService } from "@/services/conversation.services";
import {
  conversationIdParamsSchema,
  createConversationSchema,
  createMessageBodySchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
} from "@/validation";
import { InternalServerError, ValidationError } from "@shared/error-handler";
import type { RequestHandler, Request, Response, NextFunction } from "express";

const parsedConversation = (params: unknown) => {
  const { id } = conversationIdParamsSchema.parse(params);
  return id;
};

export const createConversationHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  const { userId } = req.user;
  try {
    const { error, value } = createConversationSchema.validate(req.body, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }

    const { title, participantIds } = value;
    const uniqueParticipantIds = Array.from(
      new Set([...participantIds, userId])
    );

    if (uniqueParticipantIds.length < 2) {
      throw new ValidationError(
        "Conversation must atleast include one other participant"
      );
    }

    const conversation = await conversationService.createConversation({
      title: title,
      participantIds: uniqueParticipantIds,
    });
    res.status(201).json({ data: conversation });
  } catch (e) {
    throw new InternalServerError("bad request");
  }
};

export const listConversationHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  const { userId } = req.user;

  try {
    const { error, value } = listConversationsQuerySchema.validate(req.query, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }

    const { participantId } = value;

    if (participantId !== userId) {
      throw new ValidationError("Unauthorized");
    }

    const conversations = await conversationService.listConversation({
      participantId: userId,
    });
    res.status(201).json({ data: conversations });
  } catch (e) {
    throw new InternalServerError("bad request");
  }
};

export const getConversationHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  const { userId } = req.user;

  try {
    const { error, value } = conversationIdParamsSchema.validate(req.params, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }

    const { id } = value;
    const conversation = await conversationService.getConversationById(id);

    if (!conversation.participantIds.includes(userId)) {
      throw new ValidationError("Unauthorized");
    }

    res.status(201).json({ data: conversation });
  } catch (e) {
    throw new InternalServerError("bad request");
  }
};

export const createMessageHandler: RequestHandler = async (
  req: Request,
  res: Response
) => {
  const { userId } = req.user;

  try {
    const { error, value } = conversationIdParamsSchema.validate(req.params, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }

    const { id } = value;

    const { error: messageBodyError, value: messageBodyValue } =
      createMessageBodySchema.validate(req.query, {
        abortEarly: true,
      });

    if (messageBodyError) {
      res.status(400).json({
        success: false,
        message: messageBodyError.details[0].message,
      });
      return;
    }

    const { conversationId, body } = messageBodyValue;
    const message = await messageService.createMessage(
      conversationId,
      userId,
      body
    );
    res.status(201).json({ data: message });
  } catch (e) {
    throw new InternalServerError("bad request");
  }
};

export const listMessageHandler: RequestHandler = async (req, res) => {
  const { userId } = req.user;

  try {
    const { error, value } = conversationIdParamsSchema.validate(req.params, {
      abortEarly: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
      return;
    }

    const { id } = value;

    const { error: msgError, value: msgValue } =
      listMessagesQuerySchema.validate(req.query, {
        abortEarly: true,
      });

    if (msgError) {
      res.status(400).json({
        success: false,
        message: msgError.details[0].message,
      });
      return;
    }

    const { limit, after } = msgValue;



    
  const result = after ? new Date(after) : undefined;
  const messages = await messageService.listMessages(id, userId, {
    limit: limit,
    result,
  });
  res.json({ data: messages });
  } catch (e) {
    throw new InternalServerError("bad request");
  }
};
