import { Module } from '@nestjs/common';

import { EventTicketsRepository } from './event-tickets.repository';

@Module({
  controllers: [],
  providers: [EventTicketsRepository],
  exports: [EventTicketsRepository],
})
export class EventTicketsModule {}
