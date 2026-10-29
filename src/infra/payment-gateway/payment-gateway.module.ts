import { Module, forwardRef } from '@nestjs/common';

import { PaymentGatewayWebhookEventsRepository } from './payment-gateway-webhook-events.repository';
import { IPaymentGateway } from './interfaces/ipayment-gateway.interface';
import { StripeService } from './stripe/stripe.service';
import { MessagesModule } from '../messages/messages.module';
import { StripeController } from './stripe/stripe.controller';

@Module({
  imports: [forwardRef(() => MessagesModule)],
  controllers: [StripeController],
  providers: [
    PaymentGatewayWebhookEventsRepository,
    StripeService,
    {
      provide: IPaymentGateway,
      useExisting: StripeService,
    },
  ],
  exports: [PaymentGatewayWebhookEventsRepository, IPaymentGateway],
})
export class PaymentGatewayModule {}
