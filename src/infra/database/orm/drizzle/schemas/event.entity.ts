import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  char,
  geometry,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  users,
  categories,
  countries,
} from '@/infra/database/orm/drizzle/schemas';

export const events = pgTable(
  'events',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid`),
    organizer_id: uuid()
      .references((): AnyPgColumn => users.id)
      .notNull(),
    event_category_id: uuid()
      .references((): AnyPgColumn => categories.id)
      .notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: text().notNull(),
    slug: text().notNull(),
    banner_url: text(),
    is_free: boolean().notNull(),
    address_street: varchar({ length: 100 }).notNull(),
    address_number: varchar({ length: 20 }).notNull(),
    address_district: varchar({ length: 100 }).notNull(),
    address_city: varchar({ length: 100 }).notNull(),
    country_id: char({ length: 2 })
      .references((): AnyPgColumn => countries.code)
      .notNull(),
    location: geometry('location', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),
    sales_starts_at: timestamp().notNull(),
    starts_at: timestamp().notNull(),
    ends_at: timestamp().notNull(),
    updated_at: timestamp().defaultNow(),
    created_at: timestamp().defaultNow(),
  },
  (t) => [index('spatial_index').using('gist', t.location)],
);
