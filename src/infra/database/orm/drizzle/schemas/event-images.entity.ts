import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  pgTable,
  timestamp,
  uuid,
  text,
} from 'drizzle-orm/pg-core';

import { events } from '@/infra/database/orm/drizzle/schemas';

export const event_images = pgTable('event_images', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  event_id: uuid()
    .references((): AnyPgColumn => events.id)
    .notNull(),
  url: text().notNull(),
  object_key: text().notNull(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
