
import { Router } from 'express';
import { createConversationHandler, createMessageHandler, getConversationHandler, listConversationHandler, listMessageHandler } from "./controller/conversation";

const router = Router()

//export const conversationRouter: Router = Router();



router.post(
  '/',
  createConversationHandler,
);
router.get(
  '/',
  listConversationHandler,
);
router.get(
  '/:id',
  getConversationHandler,
);

router.post(
  '/:id/messages',
  createMessageHandler,
);

router.get(
  '/:id/messages',
  listMessageHandler,
);


export default router