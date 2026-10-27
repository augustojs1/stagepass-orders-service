import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

import { IEmailsMessageProducer } from '../interfaces/iemails-message-producer.interface';
import { SendEmailMessageDto } from '@/modules/emails/dtos/send-email-message.dto';

@Injectable()
export class EmailsMessageSqsProducer implements IEmailsMessageProducer {
  private readonly logger = new Logger(EmailsMessageSqsProducer.name);
  private readonly queueUrl: string;

  constructor(
    private readonly sqsClient: SQSClient,
    private readonly configService: ConfigService,
  ) {
    this.queueUrl = this.configService.getOrThrow<string>(
      'aws.sqs.emailQueueUrl',
    );
  }

  async emit(payload: SendEmailMessageDto): Promise<void> {
    try {
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(payload),
        }),
      );

      this.logger.log(
        `Successfully published email message for order_id=${payload.order_id}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to publish email message for order_id=${payload.order_id}`,
        err.stack,
      );

      throw error;
    }
  }
}
