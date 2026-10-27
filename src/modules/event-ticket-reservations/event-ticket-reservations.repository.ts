import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ExtractTablesWithRelations } from 'drizzle-orm';
import {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
import { PgTransaction } from 'drizzle-orm/pg-core';

import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { EventTicketReservations } from './models/event-ticket-reservations.model';

@Injectable()
export class EventTicketReservationsRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async updateActiveReservationsByOrderIdTrx(
    trx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    eventTicketReservation: Partial<EventTicketReservations>,
  ): Promise<void> {
    // await trx
    //   .update(schemas.event_ticket_reservations)
    //   .set({
    //     active: false,
    //   })
    //   .where(
    //     and(
    //       eq(schemas.event_ticket_reservations.order_id, payload.order_id),
    //       eq(schemas.event_ticket_reservations.active, false),
    //     ),
    //   );

    await trx
      .update(schema.event_ticket_reservations)
      .set({
        active: eventTicketReservation.active,
      })
      .where(
        and(
          eq(
            schema.event_ticket_reservations.order_id,
            eventTicketReservation.order_id,
          ),
          eq(schema.event_ticket_reservations.active, true),
        ),
      );
  }
}
