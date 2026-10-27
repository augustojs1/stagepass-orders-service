import { Module } from '@nestjs/common';

import { EventTicketReservationsService } from './event-ticket-reservations.service';
import { EventTicketReservationsRepository } from './event-ticket-reservations.repository';

@Module({
  controllers: [],
  providers: [
    EventTicketReservationsService,
    EventTicketReservationsRepository,
  ],
  exports: [EventTicketReservationsRepository],
})
export class EventTicketReservationsModule {}
