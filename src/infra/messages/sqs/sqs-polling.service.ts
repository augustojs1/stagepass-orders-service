import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

@Injectable()
export class SqsPollingService {
  private readonly logger = new Logger(SqsPollingService.name);

  constructor(private readonly sqsClient: SQSClient) {}

  async poll<T>(
    queueUrl: string,
    handler: (payload: T) => Promise<void>,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const response = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
      }),
      { abortSignal },
    );

    for (const message of response.Messages ?? []) {
      try {
        if (!message.Body || !message.ReceiptHandle) {
          throw new Error('Invalid SQS message');
        }

        const payload = JSON.parse(message.Body) as T;

        await handler(payload);

        await this.sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
      } catch (error) {
        const err = error as Error;

        this.logger.error(
          `Failed to process SQS message ${message.MessageId}`,
          err.stack,
        );
      }
    }
  }
}
