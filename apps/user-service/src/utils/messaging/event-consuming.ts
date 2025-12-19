import amqp, { Channel, Connection, ConsumeMessage, ChannelModel } from "amqplib";
import {
  AUTH_EVENT_EXCHANGE,
  AUTH_USER_REGISTERED_ROUTING_KEY,
  AuthRegisteredEvent,
} from "@shared/types/events/auth-events";
import { syncFromAuthUser } from "@/userController";

let connection: Connection | null | any = null;
let channel: Channel | null |any = null;
let consumerTag: string | null = null;
let isConnecting = false;

const QUEUE_NAME = "user-service.auth-events";

/**
 * Handle incoming auth event messages
 */
const handleMessage = async (message: ConsumeMessage, ch: Channel) => {
  try {
    const raw = message.content.toString("utf-8");
    const event = JSON.parse(raw) as AuthRegisteredEvent;

    console.log(`📨 Received auth event: ${event.type}`, event.payload);

    // Process the event based on type
    if (event.type === AUTH_USER_REGISTERED_ROUTING_KEY) {
      await syncFromAuthUser(event.payload);
      console.log(`✅ User synced successfully: ${event.payload.email}`);
    }

    // Acknowledge the message
    ch.ack(message);
  } catch (error) {
    console.error("❌ Failed to process auth event:", error);
    // Reject and don't requeue (send to dead letter queue if configured)
    ch.nack(message, false, false);
  }
};

/**
 * Start the auth event consumer
 */
export const startAuthEventConsumer = async (
  retryCount = 0
): Promise<void> => {
  const uri = process.env.RABBITMQ_URI;

  if (!uri) {
    console.warn("RABBITMQ_URI is missing. Auth consumer will not start.");
    return;
  }

  if (isConnecting) {
    console.log("Consumer connection attempt already in progress...");
    return;
  }

  if (channel) {
    console.log("Auth event consumer already running");
    return;
  }

  isConnecting = true;

  try {
    // Remove optional chaining here
    connection = await amqp.connect(uri);
    
    // Create channel - connection.createChannel() returns Promise<Channel>
    channel = await connection.createChannel();

    if (!channel) {
      throw new Error("Failed to create channel");
    }

    // Assert exchange
    await channel.assertExchange(AUTH_EVENT_EXCHANGE, "topic", {
      durable: true,
    });

    // Assert queue
    const queue = await channel.assertQueue(QUEUE_NAME, {
      durable: true,
    });

    // Bind queue to exchange with routing key
    // queue.queue is guaranteed to exist from assertQueue
    await channel.bindQueue(
      queue.queue,
      AUTH_EVENT_EXCHANGE,
      AUTH_USER_REGISTERED_ROUTING_KEY
    );

    // Set prefetch to process one message at a time
    await channel.prefetch(1);

    // Start consuming
    const consumeResult = await channel.consume(
      queue.queue,
      (msg: ConsumeMessage | null) => {
        if (!msg) return;

        void handleMessage(msg, channel!).catch((error) => {
          console.error("Error in message handler:", error);
          channel.nack(msg, false, false);
        });
      }
    );

    // consumerTag is guaranteed from consume()
    consumerTag = consumeResult.consumerTag;

    console.log("✅ Auth event consumer started");
    isConnecting = false;

    // Handle connection events
    // Use proper type for connection - it has 'on' method
    connection.on("close", () => {
      console.warn("Auth consumer connection closed. Reconnecting...");
      connection = null;
      channel = null;
      consumerTag = null;

      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      setTimeout(() => startAuthEventConsumer(retryCount + 1), delay);
    });

    connection.on("error", (err:any) => {
      console.error("❌ Auth consumer connection error:", err);
    });

    // Handle channel events
    channel.on("close", () => {
      console.warn("Auth consumer channel closed");
      channel = null;
    });

    channel.on("error", (err:any) => {
      console.error("❌ Auth consumer channel error:", err);
    });
  } catch (error) {
    console.error("❌ Failed to start auth event consumer:", error);
    isConnecting = false;

    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    console.log(`Retrying consumer in ${delay / 1000} seconds...`);
    setTimeout(() => startAuthEventConsumer(retryCount + 1), delay);
  }
};

/**
 * Stop the auth event consumer gracefully
 */
export const stopAuthEventConsumer = async (): Promise<void> => {
  try {
    if (channel && consumerTag) {
      await channel.cancel(consumerTag);
      consumerTag = null;
    }

    if (channel) {
      const currentChannel = channel;
      channel = null;
      await currentChannel.close();
    }

    if (connection) {
      const currentConnection = connection;
      connection = null;
      await currentConnection.close();
    }

    console.log("✅ Auth event consumer stopped");
  } catch (error) {
    console.error("❌ Failed to stop auth event consumer:", error);
  }
};