import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import { TicketsService } from '@/modules/tickets/tickets.service';
import { MessageExchanges, MessageQueues } from '../../../enums';
import { IEmailsEventsConsumer } from '../../../emails/interfaces/iemails-events.consumer';
import { RabbitMqProducerService } from '@/infra/messages/brokers/rabbit-mq';

@Controller()
export class TicketsMessageRabbitMqConsumer implements IEmailsEventsConsumer {
  private readonly logger = new Logger(TicketsMessageRabbitMqConsumer.name);

  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly rabbitMqProducerService: RabbitMqProducerService,
  ) {}

  @EventPattern(MessageQueues.TICKET_GENERATE)
  async handle(
    @Payload() payload: { order_id: string },
    @Ctx() ctx: RmqContext,
  ): Promise<void> {
    const channel = ctx.getChannelRef();
    const originalMessage = ctx.getMessage();

    const headers = originalMessage.properties?.headers ?? {};
    const retry_count = Number(headers['x-retry-count'] ?? 0);

    this.logger.log(
      `Received message on queue ${MessageQueues.TICKET_GENERATE} for order_id=${payload.order_id}`,
      payload,
    );

    try {
      await this.ticketsService.handleGenerate(payload.order_id);

      this.logger.log(
        `Successfully processed message on queue ${MessageQueues.TICKET_GENERATE} for order_id=${payload.order_id}`,
        payload,
      );

      channel.ack(originalMessage);
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed to process ${MessageQueues.TICKET_GENERATE} for order_id=${payload.order_id}`,
        e?.stack,
      );

      if (retry_count < this.MAX_RETRIES) {
        await this.rabbitMqProducerService.publish(
          MessageExchanges.DLX,
          `${MessageQueues.TICKET_GENERATE}.retry`,
          {
            pattern: MessageQueues.TICKET_GENERATE,
            data: payload,
          },
          {
            'x-retry-count': retry_count + 1,
          },
        );

        this.logger.warn(
          `Message requeued to retry queue ${MessageQueues.TICKET_GENERATE}.retry for order_id=${payload.order_id}. Next retry=${retry_count + 1}`,
        );
      } else {
        await this.rabbitMqProducerService.publish(
          MessageExchanges.DLX,
          `${MessageQueues.TICKET_GENERATE}.dlq`,
          {
            pattern: MessageQueues.TICKET_GENERATE,
            data: payload,
          },
          {
            'x-retry-count': retry_count,
            'x-error-message': e?.message ?? 'Unknown error',
          },
        );

        this.logger.error(
          `Message sent to DLQ ${MessageQueues.TICKET_GENERATE}.dlq for order_id=${payload.order_id}`,
        );
      }

      channel.ack(originalMessage);
    }
  }
}
