import { forwardRef, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersMapper } from './mappers';
import { EventsModule } from '../events/events.module';
import { DateProvider } from '../shared/providers';
import { PaymentOrdersModule } from '../payment-orders/payment-orders.module';
import { PaymentGatewayModule } from '@/infra/payment-gateway/payment-gateway.module';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersRepository,
    OrdersService,
    JwtService,
    OrdersMapper,
    DateProvider,
  ],
  exports: [OrdersRepository, OrdersService, DateProvider],
  imports: [
    EventsModule,
    forwardRef(() => PaymentOrdersModule),
    PaymentGatewayModule,
  ],
})
export class OrdersModule {}
