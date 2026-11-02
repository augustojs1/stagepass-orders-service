import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { inArray, eq } from 'drizzle-orm';
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
      await this.drizzle.transaction(async (trx) => {
        const order = await this.orderRepository.findByIdTrx(
          trx,
          payload.order_id,
        );

        if (order.status === 'PAID') {
          this.logger.log(`Order order=${payload.order_id} is already paid!`);
          return;
        }

        await this.paymentOrdersRepository.updateByProviderReferenceIdTrx(trx, {
          provider_reference_id: payload.provider_reference_id,
          receipt_url: payload.receipt_url,
          status: 'SUCCEEDED',
        });

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

        const eventTicketsOrder =
          await this.orderRepository.getTicketsByOrderId(trx, payload.order_id);

        const eventTicketAmmountToBuy = new Map<string, number>();

        for (const ticket of eventTicketsOrder) {
          if (!ticket.ticket_id) continue;

          const amount =
            (eventTicketAmmountToBuy.get(ticket.ticket_id) ?? 0) + 1;

          eventTicketAmmountToBuy.set(ticket.ticket_id, amount);
        }

        const eventTicketIds = [...eventTicketAmmountToBuy.keys()];

        const eventTickets = await trx
          .select()
          .from(schemas.event_tickets)
          .where(inArray(schemas.event_tickets.id, eventTicketIds))
          .for('update');

        for (const ticket of eventTickets) {
          if (eventTicketAmmountToBuy.get(ticket.id) > ticket.amount) {
            this.logger.error(
              `Failed to process order=${payload.order_id} with ${payload.provider_reference_id} provider reference Id:: Amount of ${eventTicketAmmountToBuy.get(ticket.id)} of event_ticket_id=${ticket.id} is bigger than the ${ticket.amount} amount of tickets!`,
            );

            throw new UnprocessableEntityException(
              `Amount of ${eventTicketAmmountToBuy.get(ticket.id)} of event_ticket_id=${ticket.id} is bigger than the ${ticket.amount} amount of tickets!`,
            );
          }

          const updatedAmmount =
            ticket.amount - eventTicketAmmountToBuy.get(ticket.id);

          await this.eventTicketsRepository.updateTrx(trx, {
            id: ticket.id,
            amount: updatedAmmount,
          });
        }

        await this.paymentGatewayWebhookEventsRepository.updateByProviderReferenceIdTrx(
          trx,
          {
            process: 'PROCESSED',
            provider_reference_id: payload.provider_reference_id,
            receipt_url: payload.receipt_url,
          },
        );
      });

      const email = await this.orderRepository.findOrderUserEmail(
        payload.order_id,
      );

      if (!email) {
        this.logger.error(
          `Order user email not found for order_id=${payload.order_id}`,
        );
        throw new InternalServerErrorException(
          `Order user email not found for order_id=${payload.order_id}`,
        );
      }

      this.emailMessageProducer.emit({
        type: EmailTemplateType.PAYMENT_SUCCESS,
        to: email,
        order_id: payload.order_id,
      });
    } catch (error) {
      const e = error as Error;

      this.logger.log(
        `Failed to process success payment for order_id=${payload.order_id}`,
        e?.stack,
      );
      throw error;
    }
  }

  async handleFailedPaymentOrder(payload: PaymentFailedPayload): Promise<void> {
    try {
      await this.drizzle.transaction(async (trx) => {
        await this.paymentOrdersRepository.updateByProviderReferenceIdTrx(trx, {
          provider_reference_id: payload.provider_reference_id,
          status: 'FAILED',
          error_code: payload.error_code,
          error_message: payload.error_message,
        });

        await this.paymentGatewayWebhookEventsRepository.updateByProviderReferenceIdTrx(
          trx,
          {
            process: 'PROCESSED',
            provider_reference_id: payload.provider_reference_id,
            receipt_url: null,
            error_code: payload.error_code,
            error_message: payload.error_message,
            error_decline_code: payload.error_decline_code,
          },
        );
      });

      const email = await this.orderRepository.findOrderUserEmail(
        payload.order_id,
      );

      if (!email) {
        this.logger.error(
          `Order user email not found for order_id=${payload.order_id}`,
        );
        throw new InternalServerErrorException(
          `Order user email not found for order_id=${payload.order_id}`,
        );
      }

      this.emailMessageProducer.emit({
        type: EmailTemplateType.PAYMENT_FAILED,
        to: email,
        order_id: payload.order_id,
      });
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed updated payment_order for order=${payload.order_id}`,
        e?.stack,
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
