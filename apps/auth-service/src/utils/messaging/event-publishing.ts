import amqp, { Channel, Connection } from "amqplib";
import {
  AUTH_EVENT_EXCHANGE,
  AUTH_USER_REGISTERED_ROUTING_KEY,
  AuthUserRegisteredPayload,
} from "@shared/types/events/auth-events";

let connection: Connection | null = null;
let channel: Channel | null = null;
let isConnecting = false;

export const initPublisher = async (retryCount = 0): Promise<void> => {
  const uri = process.env.RABBITMQ_URI;

  if (!uri) {
    console.warn("RABBITMQ_URI is missing. RabbitMQ will not start.");
    return;
  }

  if (isConnecting) {
    console.log("Connection attempt already in progress...");
    return;
  }

  isConnecting = true;

  try {
    connection = await amqp.connect(uri);
    channel = await connection.createChannel();

    await channel.assertExchange(AUTH_EVENT_EXCHANGE, "topic", {
      durable: true,
    });

    console.log("✅ Auth service RabbitMQ publisher initialized");
    isConnecting = false;

    // Handle connection close
    connection.on("close", () => {
      channel = null;
      connection = null;
      console.warn("RabbitMQ connection lost. Attempting to reconnect...");

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      setTimeout(() => initPublisher(retryCount + 1), delay);
    });

    connection.on("error", (err) => {
      console.error("❌ RabbitMQ connection error:", err);
    });

    // Handle channel close
    channel.on("close", () => {
      console.warn("RabbitMQ channel closed");
      channel = null;
    });

    channel.on("error", (err) => {
      console.error("❌ RabbitMQ channel error:", err);
    });
  } catch (error) {
    console.error("❌ Failed to initialize RabbitMQ:", error);
    isConnecting = false;

    // Retry with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    console.log(`Retrying in ${delay / 1000} seconds...`);
    setTimeout(() => initPublisher(retryCount + 1), delay);
  }
};

export const publishUserRegistered = (
  payload: AuthUserRegisteredPayload
): boolean => {
  if (!channel) {
    console.error("Cannot publish: RabbitMQ channel not initialized");
    return false;
  }

  try {
    const event = {
      type: AUTH_USER_REGISTERED_ROUTING_KEY,
      payload,
      occurredAt: new Date().toISOString(),
      metadata: { version: 1 },
    };

    const published = channel.publish(
      AUTH_EVENT_EXCHANGE,
      AUTH_USER_REGISTERED_ROUTING_KEY,
      Buffer.from(JSON.stringify(event)),
      {
        contentType: "application/json",
        persistent: true,
      }
    );

    if (published) {
      console.log(`🚀 Event Published: ${AUTH_USER_REGISTERED_ROUTING_KEY}`);
      return true;
    } else {
      console.warn(`⚠️ Failed to publish: ${AUTH_USER_REGISTERED_ROUTING_KEY}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Error publishing event:", error);
    return false;
  }
};

export const closePublisher = async (): Promise<void> => {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    console.log("✅ RabbitMQ publisher closed gracefully");
  } catch (error) {
    console.error("❌ Error closing RabbitMQ publisher:", error);
  }
};

// Helper to check if publisher is ready
export const isPublisherReady = (): boolean => {
  return channel !== null && connection !== null;
};
