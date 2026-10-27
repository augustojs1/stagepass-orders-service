import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '../database/orm/drizzle/drizzle.module';

@Injectable()
export class EventTicketReservationScheduler {
  private readonly logger = new Logger(EventTicketReservationScheduler.name);

  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: 'expire-ticket-reservations',
  })
  async expireTicketReservations() {
    const MAX_BATCH_SIZE = 500;

    this.logger.log('Running routine to expire ticket reservations...');

    try {
      let totalExpired = 0;

      while (true) {
        const expiredIds = await this.expireReservationsBatch(MAX_BATCH_SIZE);
        if (expiredIds.length === 0) {
          break;
        }

        totalExpired += expiredIds.length;
      }

      if (totalExpired > 0) {
        this.logger.log(`Total of ${totalExpired} order(s) expired!`);
      }
    } catch (error) {
      this.logger.error(`Failed to run expiration job`, error);
    }
  }

  async expireReservationsBatch(limit: number): Promise<string[]> {
    return await this.drizzle.transaction(async (tx) => {
      const expiredOrders = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM orders
        WHERE status = 'AWAITING_PAYMENT'
          AND reservation_expires_at IS NOT NULL
          AND reservation_expires_at <= now()
        ORDER BY reservation_expires_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `);

      const expiredOrdersIds = expiredOrders.map((r) => r.id);

      if (expiredOrdersIds.length === 0) {
        return [];
      }

      await tx
        .update(schema.event_ticket_reservations)
        .set({
          active: false,
        })
        .where(
          and(
            eq(schema.event_ticket_reservations.active, true),
            inArray(
              schema.event_ticket_reservations.order_id,
              expiredOrdersIds,
            ),
          ),
        );

      await tx
        .update(schema.orders)
        .set({
          status: 'EXPIRED',
        })
        .where(
          and(
            eq(schema.orders.status, 'AWAITING_PAYMENT'),
            inArray(schema.orders.id, expiredOrdersIds),
          ),
        );

      return expiredOrdersIds;
    });
  }
}
