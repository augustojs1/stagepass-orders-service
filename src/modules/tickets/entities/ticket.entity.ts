import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  pgTable,
  timestamp,
  uuid,
  text,
  varchar,
  boolean,
} from 'drizzle-orm/pg-core';

import {
  users,
  event_tickets,
  order_item,
} from '@/infra/database/orm/drizzle/schemas';

export const tickets = pgTable('tickets', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  order_item_id: uuid().references((): AnyPgColumn => order_item.id),
  owner_id: uuid().references((): AnyPgColumn => users.id),
  event_ticket_id: uuid().references((): AnyPgColumn => event_tickets.id),
  file_url: text(),
  checked_in: boolean().$defaultFn(() => false),
  checked_in_at: timestamp(),
  code: varchar({ length: 20 }).unique(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
