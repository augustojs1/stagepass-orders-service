import { Module } from '@nestjs/common';

import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';

@Module({
  providers: [EventsService, EventsRepository],
  exports: [EventsService],
})
export class EventsModule {}
