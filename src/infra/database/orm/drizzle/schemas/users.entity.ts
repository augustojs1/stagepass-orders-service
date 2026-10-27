import { sql } from 'drizzle-orm';
import {
  varchar,
  pgTable,
  uuid,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  first_name: varchar({ length: 50 }).notNull(),
  last_name: varchar({ length: 50 }).notNull(),
  email: varchar({ length: 50 }).notNull(),
  password: varchar({ length: 255 }).notNull(),
  is_admin: boolean().$default(() => false),
  refresh_token: varchar({ length: 255 }),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
