import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { orders, event_tickets } from '@/infra/database/orm/drizzle/schemas';

export const order_item = pgTable('order_item', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  order_id: uuid().references((): AnyPgColumn => orders.id),
  event_ticket_id: uuid().references((): AnyPgColumn => event_tickets.id),
  owner_name: varchar({ length: 255 }).notNull(),
  owner_email: varchar({ length: 255 }).notNull(),
  unit_price: bigint({ mode: 'number' }).notNull(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
