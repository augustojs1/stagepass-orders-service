import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, asc, eq, lte } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '../database/orm/drizzle/drizzle.module';

import { Inject } from '@nestjs/common';
import { IPaymentGateway } from '@/infra/payment-gateway/interfaces/ipayment-gateway.interface';

@Injectable()
export class EventTicketReservationScheduler {
  private readonly logger = new Logger(EventTicketReservationScheduler.name);

  private readonly MAX_BATCH_SIZE = 100;

  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: 'expire-ticket-reservations',
    waitForCompletion: true,
  })
  async expireTicketReservations(): Promise<void> {
    this.logger.log('Running routine to expire ticket reservations...');

    try {
      const expiredIds = await this.expireReservationsBatch(
        this.MAX_BATCH_SIZE,
      );

      if (expiredIds.length > 0) {
        this.logger.log(`Successfully expired ${expiredIds.length} order(s)`);
      }
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        'Failed to run ticket reservation expiration job',
        err.stack,
      );
    }
  }

  async expireReservationsBatch(limit: number): Promise<string[]> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('Batch limit must be a positive integer');
    }

    const expiredOrders = await this.drizzle
      .select({
        id: schema.orders.id,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.status, 'AWAITING_PAYMENT'),
          lte(schema.orders.reservation_expires_at, new Date()),
        ),
      )
      .orderBy(asc(schema.orders.reservation_expires_at), asc(schema.orders.id))
      .limit(limit);

    if (!expiredOrders.length) {
      return [];
    }

    const expiredIds: string[] = [];

    for (const order of expiredOrders) {
      try {
        const expired = await this.expireOrder(order.id);

        if (expired) {
          expiredIds.push(order.id);
        }
      } catch (error) {
        const err = error as Error;

        this.logger.error(`Failed to expire order_id=${order.id}`, err.stack);
      }
    }

    return expiredIds;
  }

  private async expireOrder(orderId: string): Promise<boolean> {
    const paymentOrders = await this.drizzle
      .select({
        id: schema.payment_orders.id,
        provider: schema.payment_orders.provider,
        provider_reference_id: schema.payment_orders.provider_reference_id,
        status: schema.payment_orders.status,
      })
      .from(schema.payment_orders)
      .where(eq(schema.payment_orders.order_id, orderId));

    if (paymentOrders.some((payment) => payment.status === 'SUCCEEDED')) {
      this.logger.warn(
        `Skipping expiration for order_id=${orderId}: successful payment already exists`,
      );

      return false;
    }

    for (const payment of paymentOrders) {
      if (payment.provider !== 'STRIPE') {
        this.logger.warn(
          `Unsupported payment provider=${payment.provider} for order_id=${orderId}`,
        );

        return false;
      }

      const result = await this.paymentGateway.expireCheckoutSession(
        payment.provider_reference_id,
      );

      if (result === 'PAID') {
        this.logger.warn(
          `Stripe reports a successful payment. Skipping expiration for order_id=${orderId}, session_id=${payment.provider_reference_id}`,
        );

        return false;
      }

      if (result === 'UNRESOLVED') {
        this.logger.warn(
          `Stripe checkout requires reconciliation. order_id=${orderId}, session_id=${payment.provider_reference_id}`,
        );

        return false;
      }
    }

    return this.drizzle.transaction(async (trx): Promise<boolean> => {
      const [order] = await trx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .for('update');

      if (!order) {
        return false;
      }

      if (order.status !== 'AWAITING_PAYMENT') {
        this.logger.log(
          `Order_id=${orderId} has status=${order.status}. Skipping expiration.`,
        );

        return false;
      }

      if (
        !order.reservation_expires_at ||
        order.reservation_expires_at.getTime() > Date.now()
      ) {
        return false;
      }

      const currentPaymentOrders = await trx
        .select({
          id: schema.payment_orders.id,
          status: schema.payment_orders.status,
          provider_reference_id: schema.payment_orders.provider_reference_id,
        })
        .from(schema.payment_orders)
        .where(eq(schema.payment_orders.order_id, orderId));

      if (
        currentPaymentOrders.some((payment) => payment.status === 'SUCCEEDED')
      ) {
        this.logger.warn(
          `Order_id=${orderId} has a succeeded payment. Skipping expiration.`,
        );

        return false;
      }

      const verifiedPaymentIds = new Set(
        paymentOrders.map((payment) => payment.id),
      );

      const hasUnverifiedPayments = currentPaymentOrders.some(
        (payment) => !verifiedPaymentIds.has(payment.id),
      );

      if (hasUnverifiedPayments) {
        this.logger.warn(
          `New payment attempt detected for order_id=${orderId}. Deferring expiration.`,
        );

        return false;
      }

      await trx
        .update(schema.event_ticket_reservations)
        .set({
          active: false,
        })
        .where(
          and(
            eq(schema.event_ticket_reservations.active, true),
            eq(schema.event_ticket_reservations.order_id, orderId),
          ),
        );

      const [expiredOrder] = await trx
        .update(schema.orders)
        .set({
          status: 'EXPIRED',
          updated_at: new Date(),
        })
        .where(
          and(
            eq(schema.orders.id, orderId),
            eq(schema.orders.status, 'AWAITING_PAYMENT'),
          ),
        )
        .returning({
          id: schema.orders.id,
        });

      if (!expiredOrder) {
        throw new Error(`Failed to expire order_id=${orderId}`);
      }

      this.logger.log(
        `Successfully expired order_id=${orderId} and released its reservations`,
      );

      return true;
    });
  }
}
