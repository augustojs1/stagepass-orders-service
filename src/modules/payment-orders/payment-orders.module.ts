import { forwardRef, Module } from '@nestjs/common';

import { PaymentOrdersService } from './payment-orders.service';
import { PaymentOrdersRepository } from './payment-orders.repository';
import { OrdersModule } from '../orders/orders.module';
import { EventTicketReservationsModule } from '../event-ticket-reservations/event-ticket-reservations.module';
import { EventTicketsModule } from '../event-tickets/event-tickets.module';
import { PaymentGatewayModule } from '@/infra/payment-gateway/payment-gateway.module';
import { MessagesModule } from '@/infra/messages/messages.module';

@Module({
  providers: [PaymentOrdersService, PaymentOrdersRepository],
  imports: [
    forwardRef(() => OrdersModule),
    EventTicketReservationsModule,
    EventTicketsModule,
    PaymentGatewayModule,
    forwardRef(() => MessagesModule),
  ],
  exports: [PaymentOrdersService],
})
export class PaymentOrdersModule {}
