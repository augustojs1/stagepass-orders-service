import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import { IEmailsEventsConsumer } from '@/infra/messages/consumers/emails/interfaces/iemails-events.consumer';
import {
  MessageExchanges,
  MessageQueues,
} from '@/infra/messages/consumers/enums';
import { RabbitMqProducerService } from '@/infra/messages/brokers/rabbit-mq';
import { EmailsService } from '@/modules/emails/email.service';
import { SendEmailMessageDto } from '@/modules/emails/dtos/send-email-message.dto';

@Controller()
export class EmailsMessageRabbitMqConsumer implements IEmailsEventsConsumer {
  private readonly logger = new Logger(EmailsMessageRabbitMqConsumer.name);

  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly rabbitMqProducerService: RabbitMqProducerService,
    private readonly emailsService: EmailsService,
  ) {}

  @EventPattern(MessageQueues.EMAIL)
  async handle(
    @Payload() payload: SendEmailMessageDto,
    @Ctx() ctx: RmqContext,
  ): Promise<void> {
    const channel = ctx.getChannelRef();
    const originalMessage = ctx.getMessage();

    const headers = originalMessage.properties?.headers ?? {};
    const retry_count = Number(headers['x-retry-count'] ?? 0);

    this.logger.log(
      `Received message on queue ${MessageQueues.EMAIL} for order_id=${payload.order_id}`,
      payload,
    );

    try {
      await this.emailsService.sendTransactionalEmail(payload);

      channel.ack(originalMessage);
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed to process ${MessageQueues.EMAIL} for order_id=${payload.order_id}`,
        e?.stack,
      );

      if (retry_count < this.MAX_RETRIES) {
        await this.rabbitMqProducerService.publish(
          MessageExchanges.DLX,
          `${MessageQueues.EMAIL}.retry`,
          {
            pattern: MessageQueues.EMAIL,
            data: payload,
          },
          {
            'x-retry-count': retry_count + 1,
          },
        );

        this.logger.warn(
          `Message requeued to retry queue ${MessageQueues.EMAIL}.retry for order_id=${payload.order_id}. Next retry=${retry_count + 1}`,
        );
      } else {
        await this.rabbitMqProducerService.publish(
          MessageExchanges.DLX,
          `${MessageQueues.EMAIL}.dlq`,
          {
            pattern: MessageQueues.EMAIL,
            data: payload,
          },
          {
            'x-retry-count': retry_count,
            'x-error-message': e?.message ?? 'Unknown error',
          },
        );

        this.logger.error(
          `Message sent to DLQ ${MessageQueues.EMAIL}.dlq for order_id=${payload.order_id}`,
        );
      }

      channel.ack(originalMessage);
    }
  }
}
