import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  text,
  char,
} from 'drizzle-orm/pg-core';

import { orders } from '@/infra/database/orm/drizzle/schemas';

const payment_providers = pgEnum('payment_providers', ['STRIPE']);

const payment_order_statuses = pgEnum('payment_order_statuses', [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);

export const payment_orders = pgTable('payment_orders', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  order_id: uuid().references((): AnyPgColumn => orders.id),
  provider: payment_providers().notNull(),
  provider_reference_id: text(),
  status: payment_order_statuses().notNull(),
  checkout_url: text(),
  checkout_url_expires_at: timestamp(),
  amount: bigint({ mode: 'number' }).notNull(),
  currency: char({ length: 3 }).notNull(),
  receipt_url: text(),
  error_code: text(),
  error_message: text(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
