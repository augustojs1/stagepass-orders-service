import { sql } from 'drizzle-orm';
import {
  varchar,
  pgTable,
  uuid,
  timestamp,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { users } from '@/infra/database/orm/drizzle/schemas';

export const users_profile = pgTable('users_profile', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  user_id: uuid()
    .references((): AnyPgColumn => users.id)
    .notNull(),
  avatar_url: varchar({ length: 255 }),
  phone_number: varchar({ length: 255 }),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
