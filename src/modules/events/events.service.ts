import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { EventsRepository } from './events.repository';
import { EventTicketsEntity, EventsEntity } from './models';

@Injectable()
export class EventsService {
  private readonly logger: Logger = new Logger(EventsService.name);

  constructor(
    @Inject(DATABASE_TAG)
    private readonly eventsRepository: EventsRepository,
  ) {}

  async findOneElseThrow(id: string): Promise<EventsEntity> {
    const event = await this.eventsRepository.findById(id);

    if (!event) {
      throw new NotFoundException('Event with this Id does not exists!');
    }

    return event;
  }

  async findEventTicketByIdElseThrow(
    event_ticket_id: string,
  ): Promise<EventTicketsEntity> {
    const eventTicket =
      await this.eventsRepository.findEventTicketById(event_ticket_id);

    if (!eventTicket) {
      this.logger.error('Event ticket with this id not found!');
      throw new NotFoundException('Event ticket with this id not found!');
    }

    return eventTicket;
  }
}
