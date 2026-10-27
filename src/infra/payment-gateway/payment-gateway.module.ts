import { Module } from '@nestjs/common';

import { PaymentGatewayWebhookEventsRepository } from './payment-gateway-webhook-events.repository';
import { IPaymentGateway } from './interfaces/ipayment-gateway.interface';
import { StripeService } from './stripe/stripe.service';
import { MessagesModule } from '../messages/messages.module';

@Module({
  providers: [
    PaymentGatewayWebhookEventsRepository,
    {
      provide: IPaymentGateway,
      useClass: StripeService,
    },
  ],
  imports: [MessagesModule],
  exports: [PaymentGatewayWebhookEventsRepository, IPaymentGateway],
})
export class PaymentGatewayModule {}
