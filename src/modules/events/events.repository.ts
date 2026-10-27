import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';

import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import * as schema from '@/infra/database/orm/drizzle/schemas';
import { EventsEntity, EventTicketsEntity } from './models/';

@Injectable()
export class EventsRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async findById(id: string): Promise<EventsEntity | null> {
    const events = await this.drizzle
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, id));

    return events[0];
  }

  async findEventTicketById(
    event_ticket_id: string,
  ): Promise<EventTicketsEntity | null> {
    const eventTicket = await this.drizzle
      .select()
      .from(schema.event_tickets)
      .where(eq(schema.event_tickets.id, event_ticket_id));

    return eventTicket[0] ?? null;
  }
}
