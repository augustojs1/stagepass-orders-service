import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  text,
  varchar,
} from 'drizzle-orm/pg-core';

import { orders } from '@/infra/database/orm/drizzle/schemas';

const payment_providers = pgEnum('payment_providers', ['STRIPE']);

const webhook_process_statuses = pgEnum('webhook_process_statuses', [
  'PROCESSING',
  'PROCESSED',
  'FAILED_TO_PROCESS',
]);

const webhook_payment_statuses = pgEnum('webhook_payment_statuses', [
  'PAID',
  'FAILED',
]);

export const payment_gateway_webhook_events = pgTable(
  'payment_gateway_webhook_events',
  {
    id: uuid()
      .primaryKey()
      .default(sql`gen_random_uuid`),
    order_id: uuid().references((): AnyPgColumn => orders.id),
    provider: payment_providers().notNull(),
    provider_reference_id: text().unique().notNull(),
    payment_status: webhook_payment_statuses().notNull(),
    process: webhook_process_statuses().notNull(),
    event_created_at: bigint({ mode: 'number' }).notNull(),
    amount_total: bigint({ mode: 'number' }).notNull(),
    expires_at: bigint({ mode: 'number' }).notNull(),
    currency: varchar({ length: 10 }).notNull(),
    receipt_url: text(),
    error_code: text(),
    error_message: text(),
    error_decline_code: text(),
    updated_at: timestamp().defaultNow(),
    created_at: timestamp().defaultNow(),
  },
);
