import { Injectable, Logger } from '@nestjs/common';

import { IPaymentEventsConsumer } from '../interfaces/ipayments-message.consumer';

import {
  PaymentFailedPayload,
  SuccessPaymentEventPayload,
} from '@/infra/messages/consumers/models';

import { ITicketsMessageProducer } from '@/infra/messages/producers/tickets/interfaces/message-producer.interface';

import { PaymentOrdersService } from '@/modules/payment-orders/payment-orders.service';

@Injectable()
export class PaymentMessageSqsConsumer implements IPaymentEventsConsumer {
  private readonly logger = new Logger(PaymentMessageSqsConsumer.name);

  constructor(
    private readonly paymentOrderService: PaymentOrdersService,
    private readonly ticketsMessageProducer: ITicketsMessageProducer,
  ) {}

  async handleFailed(payload: PaymentFailedPayload): Promise<void> {
    this.logger.log(
      `Received failed payment message for order_id=${payload.order_id}`,
    );

    try {
      await this.paymentOrderService.handleFailedPaymentOrder(payload);

      this.logger.log(
        `Successfully processed failed payment for order_id=${payload.order_id}, provider_reference_id=${payload.provider_reference_id}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to process payment failure for order_id=${payload.order_id}`,
        err.stack,
      );

      throw error;
    }
  }

  async handleSuccess(payload: SuccessPaymentEventPayload): Promise<void> {
    this.logger.log(
      `Received successful payment message for order_id=${payload.order_id}`,
    );

    try {
      await this.paymentOrderService.handleSuccessPaymentOrder(payload);

      await this.ticketsMessageProducer.emit(payload.order_id);

      this.logger.log(
        `Successfully processed payment and published ticket generation message for order_id=${payload.order_id}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to process successful payment for order_id=${payload.order_id}`,
        err.stack,
      );

      throw error;
    }
  }
}
