import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { inArray, eq, and } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schemas from '@/infra/database/orm/drizzle/schemas';
import { PaymentOrdersRepository } from './payment-orders.repository';
import { PaymentOrderEntity } from './models/payment-order-entity.model';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { SuccessPaymentEventPayload } from '@/infra/messages/consumers/models/success-payment-event-payload.model';
import { OrdersRepository } from '../orders/orders.repository';
import { EventTicketReservationsRepository } from '../event-ticket-reservations/event-ticket-reservations.repository';
import { EventTicketsRepository } from '../event-tickets/event-tickets.repository';
import { PaymentGatewayWebhookEventsRepository } from '@/infra/payment-gateway/payment-gateway-webhook-events.repository';
import { PaymentFailedPayload } from '@/infra/messages/consumers/models';
import { IEmailsMessageProducer } from '@/infra/messages/producers/emails/interfaces/iemails-message-producer.interface';
import { EmailTemplateType } from '../emails/enums/email-template-type.enum';
import { DateProvider } from '../shared/providers';
import { InsertPaymentOrdersParams } from './models/insert-payment-orders-params.model';
import { CheckoutSessionData } from '@/infra/payment-gateway/stripe/models';
import { PaymentProviders } from './enum';

@Injectable()
export class PaymentOrdersService {
  private readonly logger: Logger = new Logger(PaymentOrdersService.name);

  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schemas>,
    private readonly paymentOrdersRepository: PaymentOrdersRepository,
    private readonly orderRepository: OrdersRepository,
    private readonly eventTicketReservationRepository: EventTicketReservationsRepository,
    private readonly eventTicketsRepository: EventTicketsRepository,
    private readonly paymentGatewayWebhookEventsRepository: PaymentGatewayWebhookEventsRepository,
    private readonly emailMessageProducer: IEmailsMessageProducer,
    private readonly dateProvider: DateProvider,
  ) {}

  async handleSuccessPaymentOrder(
    payload: SuccessPaymentEventPayload,
  ): Promise<void> {
    try {
      const paymentUpdated = await this.drizzle.transaction(
        async (trx): Promise<boolean> => {
          const [order] = await trx
            .select()
            .from(schemas.orders)
            .where(eq(schemas.orders.id, payload.order_id))
            .for('update');

          if (!order) {
            throw new NotFoundException(
              `Order order_id=${payload.order_id} not found`,
            );
          }

          const [paymentOrder] = await trx
            .select()
            .from(schemas.payment_orders)
            .where(
              and(
                eq(
                  schemas.payment_orders.provider_reference_id,
                  payload.provider_reference_id,
                ),
                eq(schemas.payment_orders.order_id, payload.order_id),
                eq(schemas.payment_orders.provider, 'STRIPE'),
              ),
            )
            .for('update');

          if (!paymentOrder) {
            throw new NotFoundException(
              `Payment provider_reference_id=${payload.provider_reference_id} not found for order_id=${payload.order_id}`,
            );
          }

          if (order.status === 'PAID') {
            if (paymentOrder.status !== 'SUCCEEDED') {
              throw new ConflictException(
                `Order order_id=${payload.order_id} is already paid, but payment provider_reference_id=${payload.provider_reference_id} is not the successful payment`,
              );
            }

            this.logger.log(`Order order_id=${payload.order_id} already paid.`);

            return false;
          }

          if (order.status !== 'AWAITING_PAYMENT') {
            throw new ConflictException(
              `Cannot confirm payment for order_id=${payload.order_id} with status=${order.status}`,
            );
          }

          if (paymentOrder.status === 'CANCELLED') {
            throw new ConflictException(
              `Payment provider_reference_id=${payload.provider_reference_id} is cancelled`,
            );
          }

          const eventTicketsOrder =
            await this.orderRepository.getTicketsByOrderId(
              trx,
              payload.order_id,
            );

          if (!eventTicketsOrder.length) {
            throw new UnprocessableEntityException(
              `No order items found for order_id=${payload.order_id}`,
            );
          }

          const eventTicketAmountToBuy = new Map<string, number>();

          for (const ticket of eventTicketsOrder) {
            if (!ticket.ticket_id) {
              throw new UnprocessableEntityException(
                `Invalid event ticket associated with order_id=${payload.order_id}`,
              );
            }

            const amount =
              (eventTicketAmountToBuy.get(ticket.ticket_id) ?? 0) + 1;

            eventTicketAmountToBuy.set(ticket.ticket_id, amount);
          }

          const eventTicketIds = [...eventTicketAmountToBuy.keys()];

          const eventTickets = await trx
            .select()
            .from(schemas.event_tickets)
            .where(inArray(schemas.event_tickets.id, eventTicketIds))
            .orderBy(schemas.event_tickets.id)
            .for('update');

          if (eventTickets.length !== eventTicketIds.length) {
            throw new NotFoundException(
              `Some event tickets were not found for order_id=${payload.order_id}`,
            );
          }

          for (const ticket of eventTickets) {
            const amountToBuy = eventTicketAmountToBuy.get(ticket.id) ?? 0;

            if (amountToBuy > ticket.amount) {
              throw new UnprocessableEntityException(
                `Insufficient tickets for event_ticket_id=${ticket.id}. Available=${ticket.amount}, requested=${amountToBuy}`,
              );
            }
          }

          for (const ticket of eventTickets) {
            const amountToBuy = eventTicketAmountToBuy.get(ticket.id) ?? 0;

            const updatedAmount = ticket.amount - amountToBuy;

            await this.eventTicketsRepository.updateTrx(trx, {
              id: ticket.id,
              amount: updatedAmount,
            });
          }

          await trx
            .update(schemas.payment_orders)
            .set({
              status: 'SUCCEEDED',
              receipt_url: payload.receipt_url,
              error_code: null,
              error_message: null,
              updated_at: new Date(),
            })
            .where(eq(schemas.payment_orders.id, paymentOrder.id));

          await this.orderRepository.updateByProviderReferenceIdTrx(trx, {
            id: payload.order_id,
            status: 'PAID',
          });

          await this.eventTicketReservationRepository.updateActiveReservationsByOrderIdTrx(
            trx,
            {
              order_id: payload.order_id,
              active: false,
            },
          );

          await this.paymentGatewayWebhookEventsRepository.updateByProviderReferenceIdTrx(
            trx,
            {
              process: 'PROCESSED',
              provider_reference_id: payload.provider_reference_id,
              receipt_url: payload.receipt_url,
              error_code: null,
              error_message: null,
              error_decline_code: null,
            },
          );

          this.logger.log(
            `Successfully confirmed payment for order_id=${payload.order_id}, provider_reference_id=${payload.provider_reference_id}`,
          );

          return true;
        },
      );

      if (!paymentUpdated) {
        return;
      }

      const email = await this.orderRepository.findOrderUserEmail(
        payload.order_id,
      );

      if (!email) {
        throw new InternalServerErrorException(
          `Order user email not found for order_id=${payload.order_id}`,
        );
      }

      this.emailMessageProducer.emit({
        type: EmailTemplateType.PAYMENT_SUCCESS,
        to: email,
        order_id: payload.order_id,
      });

      this.logger.log(
        `Successfully published payment success notification for order_id=${payload.order_id}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to process successful payment for order_id=${payload.order_id}, provider_reference_id=${payload.provider_reference_id}`,
        err.stack,
      );

      throw error;
    }
  }

  async handleFailedPaymentOrder(payload: PaymentFailedPayload): Promise<void> {
    try {
      const shouldNotify = await this.drizzle.transaction(
        async (trx): Promise<boolean> => {
          const [order] = await trx
            .select()
            .from(schemas.orders)
            .where(eq(schemas.orders.id, payload.order_id))
            .for('update');

          if (!order) {
            throw new NotFoundException(
              `Order order_id=${payload.order_id} not found`,
            );
          }

          const [paymentOrder] = await trx
            .select()
            .from(schemas.payment_orders)
            .where(
              and(
                eq(
                  schemas.payment_orders.provider_reference_id,
                  payload.provider_reference_id,
                ),
                eq(schemas.payment_orders.order_id, payload.order_id),
              ),
            )
            .for('update');

          if (!paymentOrder) {
            throw new NotFoundException(
              `Payment provider_reference_id=${payload.provider_reference_id} not found for order_id=${payload.order_id}`,
            );
          }

          // Idempotência: a falha já foi registrada.
          if (paymentOrder.status === 'FAILED') {
            this.logger.log(
              `Payment already failed. provider_reference_id=${payload.provider_reference_id}`,
            );

            return false;
          }

          if (paymentOrder.status === 'SUCCEEDED') {
            this.logger.warn(
              `Ignoring payment failure for succeeded payment. provider_reference_id=${payload.provider_reference_id}`,
            );

            return false;
          }

          if (paymentOrder.status === 'CANCELLED') {
            this.logger.warn(
              `Ignoring payment failure for cancelled payment. provider_reference_id=${payload.provider_reference_id}`,
            );

            return false;
          }

          if (paymentOrder.status !== 'PENDING') {
            throw new UnprocessableEntityException(
              `Invalid payment status transition: ${paymentOrder.status} -> FAILED`,
            );
          }

          await this.paymentOrdersRepository.updateByProviderReferenceIdTrx(
            trx,
            {
              provider_reference_id: payload.provider_reference_id,
              status: 'FAILED',
              error_code: payload.error_code,
              error_message: payload.error_message,
              updated_at: new Date(),
            },
          );

          await this.paymentGatewayWebhookEventsRepository.updateByProviderReferenceIdTrx(
            trx,
            {
              provider_reference_id: payload.provider_reference_id,
              process: 'PROCESSED',
              receipt_url: null,
              error_code: payload.error_code,
              error_message: payload.error_message,
              error_decline_code: payload.error_decline_code,
            },
          );

          this.logger.log(
            `Successfully updated payment to FAILED. order_id=${payload.order_id}, provider_reference_id=${payload.provider_reference_id}`,
          );

          if (
            order.status === 'PAID' ||
            order.status === 'CANCELLED' ||
            order.status === 'EXPIRED'
          ) {
            this.logger.log(
              `Skipping payment failure notification for order_id=${payload.order_id} with status=${order.status}`,
            );

            return false;
          }

          return true;
        },
      );

      if (!shouldNotify) {
        return;
      }

      const email = await this.orderRepository.findOrderUserEmail(
        payload.order_id,
      );

      if (!email) {
        throw new InternalServerErrorException(
          `Order user email not found for order_id=${payload.order_id}`,
        );
      }

      this.emailMessageProducer.emit({
        type: EmailTemplateType.PAYMENT_FAILED,
        to: email,
        order_id: payload.order_id,
      });

      this.logger.log(
        `Successfully published payment failure notification for order_id=${payload.order_id}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to process payment failure for order_id=${payload.order_id}, provider_reference_id=${payload.provider_reference_id}`,
        err.stack,
      );

      throw error;
    }
  }

  async updateByProviderReferenceId(
    data: Partial<PaymentOrderEntity>,
  ): Promise<void> {
    try {
      await this.paymentOrdersRepository.updateByProviderReferenceId(data);

      this.logger.log(`Updated payment_order for order=${data.order_id}`);
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed updated payment_order for order=${data.order_id}`,
        e?.stack,
      );
    }
  }

  async create(data: InsertPaymentOrdersParams): Promise<void> {
    await this.paymentOrdersRepository.create(data);

    this.logger.log(`Created new payment for order=${data.order_id}`);
  }

  async findLastPaymentOrderByOrderBy(
    order_id: string,
  ): Promise<PaymentOrderEntity> {
    return await this.paymentOrdersRepository.findLastPaymentOrderByOrderBy(
      order_id,
    );
  }

  async update(paymentOrder: PaymentOrderEntity): Promise<void> {
    return await this.paymentOrdersRepository.update(paymentOrder);
  }

  async updateAndCreateNewPaymentOrderTransaction(
    checkout_session_data: CheckoutSessionData,
    payment_order: PaymentOrderEntity,
  ): Promise<void> {
    await this.drizzle.transaction(async (trx) => {
      await trx
        .update(schemas.payment_orders)
        .set({
          ...payment_order,
        })
        .where(eq(schemas.payment_orders.id, payment_order.id));

      await trx.insert(schemas.payment_orders).values({
        order_id: payment_order.order_id,
        amount: payment_order.amount,
        currency: 'USD',
        provider: PaymentProviders[payment_order.provider],
        provider_reference_id: checkout_session_data.provider_reference_id,
        status: 'PENDING',
        checkout_url: checkout_session_data.checkout_url,
        checkout_url_expires_at: this.dateProvider.unixToDate(
          checkout_session_data.checkout_url_expires_at,
        ),
      });
    });

    return;
  }
}
