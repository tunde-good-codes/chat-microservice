
import { Router } from 'express';

const router = Router()

//export const conversationRouter: Router = Router();

conversationRouter.use(attachAuthenticatedUser);

router.post(
  '/',
  validateRequest({ body: createConversationSchema }),
  createConversationHandler,
);
router.get(
  '/',
  validateRequest({ query: listConversationsQuerySchema }),
  listConversationHandler,
);
router.get(
  '/:id',
  validateRequest({ params: conversationIdParamsSchema }),
  getConversationHandler,
);

router.post(
  '/:id/messages',
  validateRequest({ params: conversationIdParamsSchema, body: createMessageBodySchema }),
  createMessageHandler,
);

router.get(
  '/:id/messages',
  validateRequest({ params: conversationIdParamsSchema, query: listMessagesQuerySchema }),
  listMessageHandler,
);


export default router