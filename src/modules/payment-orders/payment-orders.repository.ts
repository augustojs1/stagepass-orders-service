import { Inject, Injectable } from '@nestjs/common';
import {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
import { eq, ExtractTablesWithRelations, desc } from 'drizzle-orm';

import * as schema from '@/modules/payment-orders/entities';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { PaymentOrderEntity } from './models/payment-order-entity.model';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { InsertPaymentOrdersParams } from './models/insert-payment-orders-params.model';

@Injectable()
export class PaymentOrdersRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async create(data: InsertPaymentOrdersParams): Promise<void> {
    await this.drizzle.insert(schema.payment_orders).values({
      ...data,
    });
  }

  async findLastPaymentOrderByOrderBy(
    order_id: string,
  ): Promise<PaymentOrderEntity> {
    const result = await this.drizzle
      .select()
      .from(schema.payment_orders)
      .where(eq(schema.payment_orders.order_id, order_id))
      .orderBy(desc(schema.payment_orders.created_at));

    return result[0] ?? null;
  }

  async update(paymentOrderEntity: PaymentOrderEntity): Promise<void> {
    await this.drizzle
      .update(schema.payment_orders)
      .set({
        ...paymentOrderEntity,
      })
      .where(eq(schema.payment_orders.id, paymentOrderEntity.id));
  }

  async find(order_id: string): Promise<PaymentOrderEntity> {
    const result = await this.drizzle
      .select()
      .from(schema.payment_orders)
      .where(eq(schema.payment_orders.order_id, order_id));

    return result[0] ?? null;
  }

  async updateByProviderReferenceId(
    paymentOrderEntity: Partial<PaymentOrderEntity>,
  ): Promise<void> {
    await this.drizzle
      .update(schema.payment_orders)
      .set({
        ...paymentOrderEntity,
      })
      .where(
        eq(
          schema.payment_orders.provider_reference_id,
          paymentOrderEntity.provider_reference_id,
        ),
      );
  }

  async updateByProviderReferenceIdTrx(
    trx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    paymentOrderEntity: Partial<PaymentOrderEntity>,
  ): Promise<void> {
    await trx
      .update(schema.payment_orders)
      .set({
        ...paymentOrderEntity,
      })
      .where(
        eq(
          schema.payment_orders.provider_reference_id,
          paymentOrderEntity.provider_reference_id,
        ),
      );
  }
}
