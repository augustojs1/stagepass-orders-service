import { sql } from 'drizzle-orm';
import { varchar, pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';

export const categories = pgTable('event_categories', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  name: varchar({ length: 100 }).notNull(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
