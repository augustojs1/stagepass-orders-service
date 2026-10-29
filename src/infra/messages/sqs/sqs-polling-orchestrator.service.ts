import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SqsPollingService } from './sqs-polling.service';
import { EmailsMessageSqsConsumer } from '../consumers/emails/sqs/emails-message-sqs.consumer';
import { PaymentMessageSqsConsumer } from '../consumers/payment/sqs/payment-message-sqs.consumers';

import {
  PaymentFailedPayload,
  SuccessPaymentEventPayload,
} from '../consumers/models';

import { SendEmailMessageDto } from '@/modules/emails/dtos/send-email-message.dto';

@Injectable()
export class SqsPollingOrchestratorService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SqsPollingOrchestratorService.name);

  private readonly abortController = new AbortController();

  private readonly pollingTasks: Promise<void>[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly sqsPollingService: SqsPollingService,
    private readonly emailsConsumer: EmailsMessageSqsConsumer,
    private readonly paymentConsumer: PaymentMessageSqsConsumer,
  ) {}

  onApplicationBootstrap(): void {
    this.registerPolling<SuccessPaymentEventPayload>(
      'stagepass-payment-success',
      this.configService.getOrThrow<string>(
        'aws.sqs.payment_success_queue_url',
      ),
      (payload) => this.paymentConsumer.handleSuccess(payload),
    );

    this.registerPolling<PaymentFailedPayload>(
      'stagepass-payment-failed',
      this.configService.getOrThrow<string>('aws.sqs.payment_failed_queue_url'),
      (payload) => this.paymentConsumer.handleFailed(payload),
    );

    this.registerPolling<SendEmailMessageDto>(
      'stagepass-emails',
      this.configService.getOrThrow<string>('aws.sqs.emails_queue_url'),
      (payload) => this.emailsConsumer.handle(payload),
    );
  }

  private registerPolling<T>(
    name: string,
    queueUrl: string,
    handler: (payload: T) => Promise<void>,
  ): void {
    this.pollingTasks.push(this.startPolling<T>(name, queueUrl, handler));
  }

  private async startPolling<T>(
    name: string,
    queueUrl: string,
    handler: (payload: T) => Promise<void>,
  ): Promise<void> {
    this.logger.log(`Starting SQS polling for queue=${name}`);

    const signal = this.abortController.signal;

    while (!signal.aborted) {
      try {
        await this.sqsPollingService.poll<T>(queueUrl, handler, signal);
      } catch (error) {
        if (signal.aborted) {
          break;
        }

        const err = error as Error;

        this.logger.error(`SQS polling error for queue=${name}`, err.stack);

        await this.delay(5000, signal);
      }
    }

    this.logger.log(`Stopped SQS polling for queue=${name}`);
  }

  private async delay(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timeout);
        resolve();
      };

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Stopping all SQS polling loops');

    this.abortController.abort();

    await Promise.allSettled(this.pollingTasks);
  }
}
