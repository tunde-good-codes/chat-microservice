declare module "amqplib" {
  import { EventEmitter } from "events";

  export interface Connection extends EventEmitter {
    createChannel(): Promise<Channel>;
    createConfirmChannel(): Promise<ConfirmChannel>;
    close(): Promise<void>;
  }

  export interface Channel extends EventEmitter {
    assertQueue(queue: string, options?: any): Promise<any>;
    assertExchange(exchange: string, type: string, options?: any): Promise<any>;
    publish(
      exchange: string,
      routingKey: string,
      content: Buffer,
      options?: any
    ): boolean;
    sendToQueue(queue: string, content: Buffer, options?: any): boolean;
    consume(
      queue: string,
      onMessage: (msg: Message | null) => void,
      options?: any
    ): Promise<any>;
    ack(message: Message, allUpTo?: boolean): void;
    nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
    prefetch(count: number, global?: boolean): void;
    close(): Promise<void>;
    bindQueue(queue: string, exchange: string, pattern: string): Promise<any>;
  }

  export interface ConfirmChannel extends Channel {
    publish(
      exchange: string,
      routingKey: string,
      content: Buffer,
      options?: any,
      callback?: (err: Error | null, ok: any) => void
    ): boolean;
  }

  export interface Message {
    content: Buffer;
    fields: {
      deliveryTag: number;
      redelivered: boolean;
      exchange: string;
      routingKey: string;
    };
    properties: {
      contentType?: string;
      contentEncoding?: string;
      headers?: any;
      deliveryMode?: number;
      priority?: number;
      correlationId?: string;
      replyTo?: string;
      expiration?: string;
      messageId?: string;
      timestamp?: number;
      type?: string;
      userId?: string;
      appId?: string;
    };
  }

  export function connect(url: string | any): Promise<Connection>;
}