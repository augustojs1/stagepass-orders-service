import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';

import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import * as schema from '@/infra/database/orm/drizzle/schemas';
import { InsertTicketParams } from './models/insert-ticket-params.model';
import { TicketEntity } from './models';

@Injectable()
export class TicketsRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async create(data: InsertTicketParams): Promise<TicketEntity> {
    const result = await this.drizzle
      .insert(schema.tickets)
      .values({
        ...data,
      })
      .returning();

    return result[0];
  }

  async updateFileUrl(id: string, url: string): Promise<void> {
    await this.drizzle
      .update(schema.tickets)
      .set({
        file_url: url,
      })
      .where(eq(schema.tickets.id, id));
  }

  async findTicketAndUserByOrderId(order_id: string) {
    return this.drizzle
      .select({
        ticket_id: schema.tickets.id,
        order_item_id: schema.tickets.order_item_id,
        user_email: schema.users.email,
        ticket_file_url: schema.tickets.file_url,
        ticket_code: schema.tickets.code,
      })
      .from(schema.tickets)
      .innerJoin(
        schema.order_item,
        eq(schema.tickets.order_item_id, schema.order_item.id),
      )
      .innerJoin(schema.users, eq(schema.tickets.owner_id, schema.users.id))
      .where(eq(schema.order_item.order_id, order_id));
  }

  async findByOrderIdAndOwnerId(order_id: string, owner_id: string) {
    const ticket = await this.drizzle
      .select()
      .from(schema.tickets)
      .where(
        and(
          eq(schema.tickets.order_item_id, order_id),
          eq(schema.tickets.owner_id, owner_id),
        ),
      );

    return ticket;
  }
}
