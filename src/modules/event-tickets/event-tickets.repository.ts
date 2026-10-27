import { Inject, Injectable } from '@nestjs/common';
import { eq, ExtractTablesWithRelations } from 'drizzle-orm';
import {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
import { PgTransaction } from 'drizzle-orm/pg-core';

import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { EventTicketsEntity } from './models/event-tickets-entity.model';

@Injectable()
export class EventTicketsRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async updateTrx(
    trx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    eventTicket: Partial<EventTicketsEntity>,
  ): Promise<void> {
    // await trx
    //   .update(schemas.event_tickets)
    //   .set({
    //     amount: updatedAmmount,
    //     sold: updatedAmmount === 0 ? true : false,
    //   })
    //   .where(eq(schemas.event_tickets.id, ticket.id));

    await trx
      .update(schema.event_tickets)
      .set({
        amount: eventTicket.amount,
        sold: eventTicket.amount === 0 ? true : false,
      })
      .where(eq(schema.event_tickets.id, eventTicket.id));
  }
}
