import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  orders,
  order_item,
  event_tickets,
} from '@/infra/database/orm/drizzle/schemas';

export const event_ticket_reservations = pgTable('event_ticket_reservations', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  order_id: uuid()
    .references((): AnyPgColumn => orders.id)
    .notNull(),
  order_item_id: uuid()
    .references((): AnyPgColumn => order_item.id)
    .notNull(),
  event_ticket_id: uuid()
    .references((): AnyPgColumn => event_tickets.id)
    .notNull(),
  expires_at: timestamp().notNull(),
  active: boolean().$default(() => false),
  created_at: timestamp().defaultNow(),
});
