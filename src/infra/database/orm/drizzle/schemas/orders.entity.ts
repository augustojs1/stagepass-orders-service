import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users, events } from '@/infra/database/orm/drizzle/schemas';

const order_statuses = pgEnum('status', [
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
]);

export const orders = pgTable('orders', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  user_id: uuid().references((): AnyPgColumn => users.id),
  event_id: uuid().references((): AnyPgColumn => events.id),
  status: order_statuses().notNull(),
  total_price: bigint({ mode: 'number' }).notNull(),
  reservation_expires_at: timestamp(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
