import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
  integer,
  bigint,
} from 'drizzle-orm/pg-core';

import { events } from '@/infra/database/orm/drizzle/schemas';

export const event_tickets = pgTable('event_tickets', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  event_id: uuid()
    .references((): AnyPgColumn => events.id)
    .notNull(),
  name: varchar({ length: 100 }).notNull(),
  price: bigint({ mode: 'number' }).notNull(),
  amount: integer().notNull(),
  sold: boolean().$default(() => false),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
