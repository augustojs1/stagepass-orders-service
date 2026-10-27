import { Inject, Injectable } from '@nestjs/common';
import { eq, ExtractTablesWithRelations } from 'drizzle-orm';
import {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
import { PgTransaction } from 'drizzle-orm/pg-core';

import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { PaymentGatewayWebhookEventsEntity } from './models/payment-gateway-webhook-events-entity.model';
import { InsertPaymentGatewayWebhookEventParams } from './models/insert-payment-gateway-webhook-event-params.model';

@Injectable()
export class PaymentGatewayWebhookEventsRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async insert(data: InsertPaymentGatewayWebhookEventParams): Promise<void> {
    await this.drizzle
      .insert(schema.payment_gateway_webhook_events)
      .values(data)
      .onConflictDoNothing({
        target: [schema.payment_gateway_webhook_events.provider_reference_id],
      });
  }

  async updateByProviderReferenceIdTrx(
    trx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    paymentGatewayWebhookEvent: Partial<PaymentGatewayWebhookEventsEntity>,
  ): Promise<void> {
    //  await trx
    //            .update(schemas.payment_gateway_webhook_events)
    //            .set({
    //              process: 'PROCESSED',
    //              provider_reference_id: payload.provider_reference_id,
    //              receipt_url: payload.receipt_url,
    //            })
    //            .where(
    //              eq(
    //                schemas.payment_gateway_webhook_events.provider_reference_id,
    //                payload.provider_reference_id,
    //              ),
    //            );

    await trx
      .update(schema.payment_gateway_webhook_events)
      .set({
        process: paymentGatewayWebhookEvent.process,
        receipt_url: paymentGatewayWebhookEvent.receipt_url,
      })
      .where(
        eq(
          schema.payment_gateway_webhook_events.provider_reference_id,
          paymentGatewayWebhookEvent.provider_reference_id,
        ),
      );
  }
}
