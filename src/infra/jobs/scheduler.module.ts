import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { EventTicketReservationScheduler } from './event-ticket-reservation.schedule';
import { PaymentGatewayModule } from '../payment-gateway/payment-gateway.module';

@Module({
  imports: [ScheduleModule.forRoot(), PaymentGatewayModule],
  providers: [EventTicketReservationScheduler],
})
export class SchedulerModule {}
