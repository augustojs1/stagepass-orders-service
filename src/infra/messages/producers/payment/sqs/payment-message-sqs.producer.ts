import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import { IPaymentMessageProducer } from '../interfaces/message-producer.interface';
import { FailedPaymentEventPayload } from '@/infra/payment-gateway/models/failed-payment-event.model';

@Injectable()
export class PaymentMessageSqsProducer implements IPaymentMessageProducer {
  private readonly logger = new Logger(PaymentMessageSqsProducer.name);

  constructor(
    private readonly sqsClient: SQSClient,
    private readonly configService: ConfigService,
  ) {}

  async emitSuccess(payload: any): Promise<void> {
    const queueUrl = this.configService.getOrThrow<string>(
      'aws.sqs.payment_success_queue_url',
    );

    await this.publish(queueUrl, payload);
  }

  async emitFailed(payload: FailedPaymentEventPayload): Promise<void> {
    const queueUrl = this.configService.getOrThrow<string>(
      'aws.sqs.payment_failed_queue_url',
    );

    await this.publish(queueUrl, payload);
  }

  private async publish(queueUrl: string, payload: unknown): Promise<void> {
    try {
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
        }),
      );

      this.logger.log(`Successfully published message to ${queueUrl}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish message to ${queueUrl}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }
}
