import { Injectable, Logger } from '@nestjs/common';

import { IEmailsEventsConsumer } from '../interfaces/iemails-events.consumer';
import { EmailsService } from '@/modules/emails/email.service';
import { SendEmailMessageDto } from '@/modules/emails/dtos/send-email-message.dto';

@Injectable()
export class EmailsMessageSqsConsumer implements IEmailsEventsConsumer {
  private readonly logger = new Logger(EmailsMessageSqsConsumer.name);

  constructor(private readonly emailsService: EmailsService) {}

  async handle(payload: SendEmailMessageDto): Promise<void> {
    this.logger.log(`Received email message for order_id=${payload.order_id}`);

    try {
      await this.emailsService.sendTransactionalEmail(payload);

      this.logger.log(
        `Successfully processed email message for order_id=${payload.order_id}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to process email message for order_id=${payload.order_id}`,
        err.stack,
      );

      throw error;
    }
  }
}
