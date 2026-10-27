import { configuration } from '@/infra/config/configuration';
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMqProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqProducerService.name);

  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async onModuleInit(): Promise<void> {
    const env_variables = configuration();

    this.connection = await amqp.connect(env_variables.rmq.url);
    this.channel = await this.connection.createChannel();

    this.logger.log(`Init RabbitMqProducerService`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
    headers?: Record<string, unknown>,
  ): Promise<void> {
    this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        headers,
      },
    );
  }
}
