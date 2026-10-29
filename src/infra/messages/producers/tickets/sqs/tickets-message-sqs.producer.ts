import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

import { ITicketsMessageProducer } from '../interfaces/message-producer.interface';

@Injectable()
export class TicketsMessageSqsProducer implements ITicketsMessageProducer {
  private readonly logger = new Logger(TicketsMessageSqsProducer.name);

  private readonly queueUrl: string;

  constructor(
    private readonly sqsClient: SQSClient,
    private readonly configService: ConfigService,
  ) {
    this.queueUrl = this.configService.getOrThrow<string>(
      'aws.sqs.tickets_generate_queue_url',
    );
  }

  async emit(order_id: string): Promise<void> {
    await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({
          order_id,
        }),
      }),
    );

    this.logger.log(
      `Published ticket generation message to SQS for order_id=${order_id}`,
    );
  }
}
