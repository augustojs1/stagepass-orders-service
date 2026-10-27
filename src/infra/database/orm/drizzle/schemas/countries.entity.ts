import { varchar, pgTable, timestamp, char } from 'drizzle-orm/pg-core';

export const countries = pgTable('countries', {
  code: char({ length: 2 }),
  name: varchar({ length: 50 }).notNull(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
