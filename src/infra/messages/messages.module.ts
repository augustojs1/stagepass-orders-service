import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SqsModule } from './sqs/sqs.module';
import { ITicketsMessageProducer } from './producers/tickets/interfaces/message-producer.interface';
import { IPaymentMessageProducer } from './producers/payment/interfaces/message-producer.interface';
import { IEmailsMessageProducer } from './producers/emails/interfaces/iemails-message-producer.interface';
import { TicketsMessageSqsProducer } from './producers/tickets/s3/tickets-message-sqs.producer';
import { PaymentMessageSqsProducer } from './producers/payment/sqs/payment-message-sqs.producer';
import { EmailsMessageSqsProducer } from './producers/emails/sqs/emails-message-sqs.producer';
import { SqsPollingOrchestratorService } from './sqs/sqs-polling-orchestrator.service';
import { EmailsMessageSqsConsumer } from './consumers/emails/sqs/emails-message-sqs.consumer';
import { PaymentMessageSqsConsumer } from './consumers/payment/sqs/payment-message-sqs.consumers';
import { EmailsModule } from '@/modules/emails/emails.module';
import { PaymentOrdersModule } from '@/modules/payment-orders/payment-orders.module';

@Module({
  imports: [ConfigModule, SqsModule, EmailsModule, PaymentOrdersModule],
  providers: [
    SqsPollingOrchestratorService,
    EmailsMessageSqsConsumer,
    PaymentMessageSqsConsumer,
    {
      provide: ITicketsMessageProducer,
      useClass: TicketsMessageSqsProducer,
    },
    {
      provide: IPaymentMessageProducer,
      useClass: PaymentMessageSqsProducer,
    },
    {
      provide: IEmailsMessageProducer,
      useClass: EmailsMessageSqsProducer,
    },
  ],
  exports: [
    ITicketsMessageProducer,
    IPaymentMessageProducer,
    IEmailsMessageProducer,
  ],
})
export class MessagesModule {}
