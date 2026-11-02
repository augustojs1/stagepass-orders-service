import { Module } from '@nestjs/common';

import { EventTicketReservationsRepository } from './event-ticket-reservations.repository';

@Module({
  providers: [EventTicketReservationsRepository],
  exports: [EventTicketReservationsRepository],
})
export class EventTicketReservationsModule {}
