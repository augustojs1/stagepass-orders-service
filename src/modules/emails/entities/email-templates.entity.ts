import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uuid, text, pgEnum } from 'drizzle-orm/pg-core';

const email_template_type = pgEnum('email_template_type', [
  'TICKETS_AVAILABLE',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
]);

export const email_templates = pgTable('email_templates', {
  id: uuid()
    .primaryKey()
    .default(sql`gen_random_uuid`),
  html: text().unique().notNull(),
  type: email_template_type().notNull(),
  updated_at: timestamp().defaultNow(),
  created_at: timestamp().defaultNow(),
});
