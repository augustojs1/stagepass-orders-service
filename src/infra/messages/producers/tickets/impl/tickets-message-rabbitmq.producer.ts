import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { MessageQueues } from '@/infra/messages/consumers/enums';
import { ITicketsMessageProducer } from '../interfaces/message-producer.interface';

@Injectable()
export class TicketsMessageRabbitMqProducer implements ITicketsMessageProducer {
  private readonly logger = new Logger(TicketsMessageRabbitMqProducer.name);

  constructor(
    @Inject('ticket_queue')
    private readonly rabbitMqClient: ClientProxy,
  ) {}

  emit(order_id: string): void {
    this.rabbitMqClient.emit(MessageQueues.TICKET_GENERATE, {
      order_id: order_id,
    });

    this.logger.log(
      `Publish message on queue ${MessageQueues.TICKET_GENERATE}.`,
    );
  }
}
