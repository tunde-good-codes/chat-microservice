import amqp from "amqplib"; // ✅ Import default
import type { Channel, Connection } from "amqplib";
import {
  USER_EVENTS_EXCHANGE,
  USER_CREATED_ROUTING_KEY,
  UserCreatedEvent,
  UserCreatedPayload,
} from "@shared/types/events/user-events";

let connection: Connection | null | any = null;
let channel: Channel | null = null;

const messagingEnabled = Boolean(process.env.RABBITMQ_URI);

const ensureChannel = async (): Promise<Channel | null> => {
  if (!messagingEnabled) {
    return null;
  }

  if (channel) {
    return channel;
  }

  if (!process.env.RABBITMQ_URI) {
    return null;
  }

  try {
    const amqpConnection = await amqp.connect(process.env.RABBITMQ_URI); // ✅ Use amqp.connect
    connection = amqpConnection;

    amqpConnection.on("close", () => {
      console.warn("User publisher RabbitMQ connection closed");
      connection = null;
      channel = null;
    });

    amqpConnection.on("error", (error) => {
      console.error("❌ User publisher RabbitMQ connection error:", error);
    });

    const amqpChannel = await amqpConnection.createChannel();
    channel = amqpChannel;

    await amqpChannel.assertExchange(USER_EVENTS_EXCHANGE, "topic", {
      durable: true,
    });

    console.log("✅ User service RabbitMQ publisher initialized");
    return amqpChannel;
  } catch (error) {
    console.error("❌ Failed to create RabbitMQ channel:", error);
    return null;
  }
};

export const initMessaging = async (): Promise<void> => {
  if (!messagingEnabled) {
    console.info("RabbitMQ URL is not configured; messaging disabled");
    return;
  }

  await ensureChannel();
  console.info("User service RabbitMQ publisher initialized");
};

export const closeMessaging = async (): Promise<void> => {
  try {
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

    console.info("✅ User service RabbitMQ publisher closed");
  } catch (error) {
    console.error("❌ Error closing RabbitMQ connection/channel:", error);
  }
};

export const publishUserCreatedEvent = async (
  payload: UserCreatedPayload
): Promise<void> => {
  const ch = await ensureChannel();

  if (!ch) {
    console.debug("Skipping user.created event publish; messaging disabled");
    return;
  }

  const event: UserCreatedEvent = {
    type: USER_CREATED_ROUTING_KEY,
    payload,
    occurredAt: new Date().toISOString(),
    metadata: { version: 1 },
  };

  try {
    const success = ch.publish(
      USER_EVENTS_EXCHANGE,
      USER_CREATED_ROUTING_KEY,
      Buffer.from(JSON.stringify(event)),
      {
        contentType: "application/json",
        persistent: true,
      }
    );

    if (!success) {
      console.warn("⚠️ Failed to publish user.created event", event);
    } else {
      console.log(`🚀 Event Published: ${USER_CREATED_ROUTING_KEY}`, {
        userId: payload.id,
        email: payload.email,
      });
    }
  } catch (error) {
    console.error("❌ Error publishing user.created event:", error);
  }
};
