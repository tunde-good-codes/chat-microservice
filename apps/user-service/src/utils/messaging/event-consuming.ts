import { connect, Channel, Connection, ConsumeMessage, Replies } from 'amqplib';
import { 
  AUTH_EVENT_EXCHANGE, 
  AUTH_USER_REGISTERED_ROUTING_KEY, 
  AuthUserRegisteredPayload 
} from '@shared/types/events/auth-events';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { userService } from '@/services/user.service';

// State management
let connection: Connection | null = null;
let channel: Channel | null = null;
let consumerTag: string | null = null;
let isConnecting = false;

const QUEUE_NAME = 'user-service.auth-events'; // Descriptive queue name

/**
 * Logic to process the actual message content
 */
const handleMessage = async (message: ConsumeMessage, ch: Channel) => {
  try {
    const raw = message.content.toString('utf-8');
    const event = JSON.parse(raw);
    
    // Pass the payload to your business logic
    await userService.syncFromAuthUser(event.payload);

    // Acknowledge: "I've processed this successfully"
    ch.ack(message);
  } catch (error) {
    logger.error({ err: error }, 'Failed to process auth event');
    
    // Nack: "I failed." 
    // Requeue: false (don't loop forever if the data is malformed)
    ch.nack(message, false, false); 
  }
};

/**
 * Starts the consumer and sets up topology
 */
export const startAuthEventConsumer = async (retryCount = 0): Promise<void> => {
  if (!env.RABBITMQ_URL) {
    logger.warn('RabbitMQ URL missing. Consumer will not start.');
    return;
  }

  if (isConnecting || channel) return;
  isConnecting = true;

  try {
    connection = await connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // 1. Ensure the exchange exists
    await channel.assertExchange(AUTH_EVENT_EXCHANGE, 'topic', { durable: true });

    // 2. Ensure the queue exists
    // Durable: survives RabbitMQ restart
    const q = await channel.assertQueue(QUEUE_NAME, { durable: true });

    // 3. Bind the queue to the exchange with the routing key
    await channel.bindQueue(q.queue, AUTH_EVENT_EXCHANGE, AUTH_USER_REGISTERED_ROUTING_KEY);

    // 4. Start consuming
    const result: Replies.Consume = await channel.consume(q.queue, (msg) => {
      if (msg) void handleMessage(msg, channel!);
    });

    consumerTag = result.consumerTag;
    isConnecting = false;
    logger.info('✅ Auth event consumer connected and listening');

    // Handle Connection failures
    connection.on('close', () => {
      logger.warn('RabbitMQ consumer connection lost. Retrying...');
      cleanupState();
      reconnect(retryCount);
    });

  } catch (error) {
    isConnecting = false;
    logger.error({ err: error }, 'Failed to initialize RabbitMQ consumer');
    reconnect(retryCount);
  }
};

/**
 * Helpers for cleanup and reconnection
 */
const cleanupState = () => {
  connection = null;
  channel = null;
  consumerTag = null;
};

const reconnect = (retryCount: number) => {
  const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
  setTimeout(() => startAuthEventConsumer(retryCount + 1), delay);
};

export const stopAuthEventConsume = async () => {
  if (channel && consumerTag) await channel.cancel(consumerTag);
  if (connection) await connection.close();
  cleanupState();
};