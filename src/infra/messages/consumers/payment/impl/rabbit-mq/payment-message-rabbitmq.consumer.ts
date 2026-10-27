import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

import { MessageExchanges, MessageQueues } from '../../../enums';
import { IPaymentEventsConsumer } from '../../interfaces/ipayments-message.consumer';
import { PaymentFailedPayload } from '../../../models';
import { SuccessPaymentEventPayload } from '../../../models/success-payment-event-payload.model';
import { ITicketsMessageProducer } from '@/infra/messages/producers/tickets/interfaces/message-producer.interface';
import { PaymentOrdersService } from '@/modules/payment-orders/payment-orders.service';
import { RabbitMqProducerService } from '@/infra/messages/brokers/rabbit-mq';

@Controller()
export class PaymentMessageRabbitMqConsumer {
  private readonly logger = new Logger(PaymentMessageRabbitMqConsumer.name);

  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly paymentOrderService: PaymentOrdersService,
    private readonly ticketsMessageProducer: ITicketsMessageProducer,
    private readonly rabbitMqProducerService: RabbitMqProducerService,
  ) {}

  @EventPattern(MessageQueues.PAYMENT_FAILED)
  async handleFailed(@Payload() payload: PaymentFailedPayload): Promise<void> {
    // const channel = ctx.getChannelRef();
    // const originalMessage = ctx.getMessage();
    // const headers = originalMessage.properties?.headers ?? {};
    // const retry_count = Number(headers['x-retry-count'] ?? 0);
    // this.logger.log(
    //   `Receveid message on queue ${MessageQueues.PAYMENT_FAILED}`,
    //   payload,
    // );
    // try {
    //   await this.paymentOrderService.handleFailedPaymentOrder(payload);
    //   this.logger.log(
    //     `Successfully processed message on queue ${MessageQueues.PAYMENT_FAILED} for order_id=${payload.order_id}, provider_reference_id=${payload.provider_reference_id}`,
    //     payload,
    //   );
    //   channel.ack(originalMessage);
    // } catch (error) {
    //   const e = error as Error;
    //   this.logger.error(
    //     `Failed to process ${MessageQueues.PAYMENT_FAILED} for order_id=${payload.order_id}, provider_reference_id=${payload.provider_reference_id}`,
    //     e?.stack,
    //   );
    //   if (retry_count < this.MAX_RETRIES) {
    //     await this.rabbitMqProducerService.publish(
    //       MessageExchanges.DLX,
    //       `${MessageQueues.PAYMENT_FAILED}.retry`,
    //       {
    //         pattern: MessageQueues.PAYMENT_FAILED,
    //         data: payload,
    //       },
    //       {
    //         'x-retry-count': retry_count + 1,
    //       },
    //     );
    //     this.logger.warn(
    //       `Message requeued to retry queue ${MessageQueues.PAYMENT_FAILED}.retry for order_id=${payload.order_id}. Next retry=${retry_count + 1}`,
    //     );
    //   } else {
    //     await this.rabbitMqProducerService.publish(
    //       MessageExchanges.DLX,
    //       `${MessageQueues.PAYMENT_FAILED}.dlq`,
    //       {
    //         pattern: MessageQueues.PAYMENT_FAILED,
    //         data: payload,
    //       },
    //       {
    //         'x-retry-count': retry_count,
    //         'x-error-message': e?.message ?? 'Unknown error',
    //       },
    //     );
    //     this.logger.error(
    //       `Message sent to DLQ ${MessageQueues.PAYMENT_FAILED}.dlq for order_id=${payload.order_id}`,
    //     );
    //   }
    //   channel.ack(originalMessage);
  }
}
