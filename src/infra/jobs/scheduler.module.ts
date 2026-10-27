import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { EventTicketReservationScheduler } from './event-ticket-reservation.schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [EventTicketReservationScheduler],
})
export class SchedulerModule {}
