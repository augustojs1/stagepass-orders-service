import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, count, eq, inArray, gt, desc } from 'drizzle-orm';

import { OrdersRepository } from './orders.repository';
import { OrderEmailTemplateData } from '../emails/models';
import { currencyFormatter, dateFormatter } from '@/utils';
import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import {
  CreateOrderDto,
  CreateOrderItemDto,
  CreateOrderResponseDto,
  OrderItemResponseDto,
  PayOrderCheckoutResponseDto,
  PayOrderDto,
} from './dto';
import { PaymentProviders } from '../payment-orders/enum';
import { IPaymentGateway } from '@/infra/payment-gateway/interfaces/ipayment-gateway.interface';
import { CheckoutSessionData } from '@/infra/payment-gateway/stripe/models';
import { OrderItemEntity, OrdersEntity } from './models';
import { DateProvider } from '../shared/providers';
import { EventsService } from '../events/events.service';
import { OrdersMapper } from './mappers';
import { PaymentOrdersService } from '../payment-orders/payment-orders.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly RESERVATION_EXPIRES_AT_IN_MIN = 20 * 60 * 1000; // 20 min

  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
    private readonly ordersRepository: OrdersRepository,
    private readonly eventsService: EventsService,
    private readonly dateProvider: DateProvider,
    private readonly ordersMapper: OrdersMapper,
    private readonly paymentOrdersService: PaymentOrdersService,
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  async create(
    user_id: string,
    createOrderDto: CreateOrderDto,
  ): Promise<CreateOrderResponseDto> {
    try {
      const MIN_HOURS_BEFORE_EVENT_STARTS = -1;

      const event = await this.eventsService.findOneElseThrow(
        createOrderDto.event_id,
      );

      const differenceInHours = this.dateProvider.differenceInHours(
        new Date(),
        new Date(event.starts_at),
      );

      if (differenceInHours >= MIN_HOURS_BEFORE_EVENT_STARTS) {
        this.logger.error(
          `Event starts at time limit has passed user_id=${user_id}, event_id=${createOrderDto.event_id}`,
        );
        throw new BadRequestException('Event starts at time limit has passed!');
      }

      const createdOrder = await this.ordersRepository.insertOrder({
        user_id,
        event_id: event.id,
      });

      this.logger.log(
        `Succesfully created order user_id=${user_id}, event_id=${createOrderDto.event_id}`,
      );

      return this.ordersMapper.mapOrderEntityToCreateOrderReponseDto(
        createdOrder,
      );
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed to create order user_id=${user_id}, event_id=${createOrderDto.event_id}`,
        e?.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create order');
    }
  }

  private async findOneElseThrow(order_id: string): Promise<OrdersEntity> {
    const order = await this.ordersRepository.findOneById(order_id);

    if (!order) {
      this.logger.error('Order with this id not found!');
      throw new NotFoundException('Order with this id not found!');
    }

    return order;
  }

  private async findOneItemElseThrow(
    order_item_id: string,
  ): Promise<OrderItemEntity> {
    const orderItem =
      await this.ordersRepository.findOneOrderItemById(order_item_id);

    if (!orderItem) {
      this.logger.error('Order item with this id not found!');
      throw new NotFoundException('Order item with this id not found!');
    }

    return orderItem;
  }

  async createOrderItem(
    user_id: string,
    order_id: string,
    createOrderItemDto: CreateOrderItemDto,
  ): Promise<OrderItemResponseDto[]> {
    try {
      const orderItems = await this.drizzle.transaction(async (trx) => {
        const [order] = await trx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, order_id))
          .for('update');

        if (!order) {
          throw new NotFoundException(`Order order_id=${order_id} not found!`);
        }

        if (order.user_id !== user_id) {
          throw new ForbiddenException(
            `User does not own order_id=${order_id}!`,
          );
        }

        if (order.status !== 'PENDING') {
          throw new UnprocessableEntityException(
            `Cannot add items to order_id=${order_id} with status=${order.status}`,
          );
        }

        const [eventTicket] = await trx
          .select()
          .from(schema.event_tickets)
          .where(
            eq(schema.event_tickets.id, createOrderItemDto.event_ticket_id),
          )
          .limit(1);

        if (!eventTicket) {
          throw new NotFoundException(
            `Event ticket_id=${createOrderItemDto.event_ticket_id} not found!`,
          );
        }

        if (eventTicket.event_id !== order.event_id) {
          throw new BadRequestException(
            `Event ticket does not belong to order event!`,
          );
        }

        if (eventTicket.sold || eventTicket.amount <= 0) {
          throw new ConflictException(
            `Event ticket_id=${eventTicket.id} is sold out!`,
          );
        }

        const [createdOrderItem] = await trx
          .insert(schema.order_item)
          .values({
            order_id: order.id,
            event_ticket_id: eventTicket.id,
            unit_price: eventTicket.price,
            owner_name: createOrderItemDto.owner_name,
            owner_email: createOrderItemDto.owner_email,
          })
          .returning();

        this.logger.log(
          `Successfully created order_item_id=${createdOrderItem.id} for order_id=${order_id}`,
        );

        const items = await trx
          .select()
          .from(schema.order_item)
          .where(eq(schema.order_item.order_id, order_id));

        return items;
      });

      return this.ordersMapper.mapOrderItemEntityToOrderItemResponseDto(
        orderItems,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to create order item user_id=${user_id}, order_id=${order_id}, event_ticket_id=${createOrderItemDto.event_ticket_id}`,
        err.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create order item!');
    }
  }

  async removeOrderItem(
    user_id: string,
    order_id: string,
    order_item_id: string,
  ): Promise<void> {
    try {
      await this.drizzle.transaction(async (trx) => {
        const [order] = await trx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, order_id))
          .for('update');

        if (!order) {
          throw new NotFoundException(`Order order_id=${order_id} not found!`);
        }

        if (order.user_id !== user_id) {
          throw new ForbiddenException(
            `User does not own order_id=${order_id}!`,
          );
        }

        if (order.status !== 'PENDING') {
          throw new UnprocessableEntityException(
            `Cannot remove items from order_id=${order_id} with status=${order.status}`,
          );
        }

        const [orderItem] = await trx
          .select()
          .from(schema.order_item)
          .where(eq(schema.order_item.id, order_item_id))
          .limit(1);

        if (!orderItem) {
          throw new NotFoundException(
            `Order item order_item_id=${order_item_id} not found!`,
          );
        }

        if (orderItem.order_id !== order.id) {
          throw new ForbiddenException(
            `Order item order_item_id=${order_item_id} does not belong to order_id=${order_id}!`,
          );
        }

        const [deletedOrderItem] = await trx
          .delete(schema.order_item)
          .where(
            and(
              eq(schema.order_item.id, order_item_id),
              eq(schema.order_item.order_id, order_id),
            ),
          )
          .returning({
            id: schema.order_item.id,
          });

        if (!deletedOrderItem) {
          throw new NotFoundException(
            `Order item order_item_id=${order_item_id} could not be deleted!`,
          );
        }

        this.logger.log(
          `Successfully removed order_item_id=${order_item_id} from order_id=${order_id}`,
        );
      });
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to remove order item user_id=${user_id}, order_id=${order_id}, order_item_id=${order_item_id}`,
        err.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to remove order item');
    }
  }

  async confirmOrder(
    user_id: string,
    order_id: string,
  ): Promise<CreateOrderResponseDto> {
    try {
      const updatedOrder = await this.drizzle.transaction(async (trx) => {
        const [order] = await trx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, order_id))
          .for('update');

        if (!order) {
          throw new NotFoundException(`Order order_id=${order_id} not found!`);
        }

        if (order.user_id !== user_id) {
          throw new ForbiddenException(
            `User does not own order_id=${order_id}!`,
          );
        }

        if (order.status !== 'PENDING') {
          throw new UnprocessableEntityException(
            `Order order_id=${order_id} cannot be confirmed with status=${order.status}`,
          );
        }

        const orderItems = await trx
          .select({
            id: schema.order_item.id,
            event_ticket_id: schema.order_item.event_ticket_id,
            unit_price: schema.order_item.unit_price,
          })
          .from(schema.order_item)
          .where(eq(schema.order_item.order_id, order_id));

        if (!orderItems.length) {
          throw new UnprocessableEntityException(
            `Order order_id=${order_id} must contain at least one item!`,
          );
        }

        const eventTicketAmountToBuy = new Map<string, number>();

        for (const item of orderItems) {
          if (!item.event_ticket_id) {
            throw new UnprocessableEntityException(
              `Order item ${item.id} has no event_ticket_id!`,
            );
          }

          const currentAmount =
            eventTicketAmountToBuy.get(item.event_ticket_id) ?? 0;

          eventTicketAmountToBuy.set(item.event_ticket_id, currentAmount + 1);
        }

        const eventTicketIds = [...eventTicketAmountToBuy.keys()];

        const eventTickets = await trx
          .select()
          .from(schema.event_tickets)
          .where(inArray(schema.event_tickets.id, eventTicketIds))
          .orderBy(schema.event_tickets.id)
          .for('update');

        if (eventTickets.length !== eventTicketIds.length) {
          throw new NotFoundException(
            `Some event tickets were not found for order_id=${order_id}`,
          );
        }

        const now = new Date();

        const ticketsReserved = await trx
          .select({
            event_ticket_id: schema.event_ticket_reservations.event_ticket_id,

            reserved: count(schema.event_ticket_reservations.event_ticket_id),
          })
          .from(schema.event_ticket_reservations)
          .where(
            and(
              eq(schema.event_ticket_reservations.active, true),
              gt(schema.event_ticket_reservations.expires_at, now),
              inArray(
                schema.event_ticket_reservations.event_ticket_id,
                eventTicketIds,
              ),
            ),
          )
          .groupBy(schema.event_ticket_reservations.event_ticket_id);

        const ticketsReservedMap = new Map<string, number>();

        for (const reservation of ticketsReserved) {
          ticketsReservedMap.set(
            reservation.event_ticket_id,
            Number(reservation.reserved),
          );
        }

        for (const ticket of eventTickets) {
          const amountToBuy = eventTicketAmountToBuy.get(ticket.id) ?? 0;

          const reservedAmount = ticketsReservedMap.get(ticket.id) ?? 0;

          const availableAmount = ticket.amount - reservedAmount;

          if (amountToBuy > availableAmount) {
            this.logger.warn(
              `Insufficient tickets for event_ticket_id=${ticket.id}. ` +
                `Available=${availableAmount}, ` +
                `Requested=${amountToBuy}, ` +
                `Reserved=${reservedAmount}`,
            );

            throw new ConflictException(
              `Not enough tickets available for event_ticket_id=${ticket.id}`,
            );
          }
        }

        const expiresAt = new Date(
          Date.now() + this.RESERVATION_EXPIRES_AT_IN_MIN,
        );

        const reservations = orderItems.map((item) => ({
          order_id: order.id,
          order_item_id: item.id,
          event_ticket_id: item.event_ticket_id!,
          expires_at: expiresAt,
          active: true,
        }));

        await trx.insert(schema.event_ticket_reservations).values(reservations);

        const totalPrice = orderItems.reduce(
          (total, item) => total + Number(item.unit_price),
          0,
        );

        const [confirmedOrder] = await trx
          .update(schema.orders)
          .set({
            reservation_expires_at: expiresAt,
            status: 'AWAITING_PAYMENT',
            total_price: totalPrice,
            updated_at: new Date(),
          })
          .where(eq(schema.orders.id, order_id))
          .returning();

        this.logger.log(
          `Successfully confirmed order_id=${order_id}. ` +
            `Reserved ${orderItems.length} tickets.`,
        );

        return confirmedOrder;
      });

      return this.ordersMapper.mapOrderEntityToCreateOrderReponseDto(
        updatedOrder,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to confirm order user_id=${user_id}, order_id=${order_id}`,
        err.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to confirm order');
    }
  }

  private async createCheckout(
    order: {
      id: string;
      total_price: number;
    },
    provider: PaymentProviders,
    idempotencyKey: string,
  ): Promise<CheckoutSessionData> {
    switch (provider) {
      case PaymentProviders.STRIPE:
        return this.paymentGateway.process({
          order_id: order.id,
          amount: order.total_price,
          idempotency_key: idempotencyKey,
        });

      default:
        throw new UnprocessableEntityException('Unsupported payment provider');
    }
  }

  private createPendingResponse(
    checkout: CheckoutSessionData,
  ): PayOrderCheckoutResponseDto {
    return {
      receipt_url: null,
      status: 'PENDING',
      provider: checkout.provider,
      checkout_url: checkout.checkout_url,
      checkout_url_expires_at: this.dateProvider
        .unixToDate(checkout.checkout_url_expires_at)
        .toISOString(),
    };
  }

  async payOrder(
    user_id: string,
    order_id: string,
    pay_order_dto: PayOrderDto,
  ): Promise<PayOrderCheckoutResponseDto> {
    try {
      return await this.drizzle.transaction(async (trx) => {
        const [order] = await trx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, order_id))
          .for('update');

        if (!order) {
          throw new NotFoundException(`Order order_id=${order_id} not found`);
        }

        if (order.user_id !== user_id) {
          throw new ForbiddenException(
            `User does not own order_id=${order_id}`,
          );
        }

        if (order.status === 'PAID') {
          const [successfulPayment] = await trx
            .select()
            .from(schema.payment_orders)
            .where(
              and(
                eq(schema.payment_orders.order_id, order.id),
                eq(schema.payment_orders.status, 'SUCCEEDED'),
              ),
            )
            .orderBy(
              desc(schema.payment_orders.created_at),
              desc(schema.payment_orders.id),
            )
            .limit(1);

          if (!successfulPayment) {
            throw new ConflictException(
              `Order ${order.id} is PAID but no successful payment exists`,
            );
          }

          return {
            status: 'SUCCEEDED',
            receipt_url: successfulPayment.receipt_url,
            provider: successfulPayment.provider as PaymentProviders,
            checkout_url: null,
            checkout_url_expires_at: null,
          };
        }

        if (order.status !== 'AWAITING_PAYMENT') {
          throw new UnprocessableEntityException(
            `Order ${order.id} cannot be paid with status=${order.status}`,
          );
        }

        if (!order.reservation_expires_at) {
          throw new ConflictException(
            `Order ${order.id} has no active reservation`,
          );
        }

        const reservationExpiresAt = new Date(order.reservation_expires_at);

        if (
          Number.isNaN(reservationExpiresAt.getTime()) ||
          this.dateProvider.isExpired(reservationExpiresAt)
        ) {
          throw new ConflictException(
            `Reservation expired for order_id=${order.id}`,
          );
        }

        const provider = PaymentProviders[pay_order_dto.payment_provider];

        if (provider !== PaymentProviders.STRIPE) {
          throw new UnprocessableEntityException(
            'Unsupported payment provider',
          );
        }

        const [paymentOrder] = await trx
          .select()
          .from(schema.payment_orders)
          .where(eq(schema.payment_orders.order_id, order.id))
          .orderBy(
            desc(schema.payment_orders.created_at),
            desc(schema.payment_orders.id),
          )
          .limit(1);

        if (paymentOrder?.status === 'SUCCEEDED') {
          throw new ConflictException(
            `Payment already succeeded for order_id=${order.id}, but order is not PAID`,
          );
        }

        // Reutiliza uma sessão pendente que ainda esteja
        // dentro do prazo de validade registrado.
        if (paymentOrder?.status === 'PENDING') {
          if (
            !paymentOrder.checkout_url ||
            !paymentOrder.checkout_url_expires_at
          ) {
            throw new ConflictException(
              `Payment ${paymentOrder.id} has incomplete checkout data`,
            );
          }

          if (
            this.dateProvider.isExpired(paymentOrder.checkout_url_expires_at)
          ) {
            throw new ConflictException(
              `Checkout session expired for order_id=${order.id}. Payment reconciliation required.`,
            );
          }

          this.logger.log(`Reusing Stripe checkout for order_id=${order.id}`);

          return {
            status: 'PENDING',
            receipt_url: paymentOrder.receipt_url,
            provider: paymentOrder.provider as PaymentProviders,
            checkout_url: paymentOrder.checkout_url,
            checkout_url_expires_at:
              paymentOrder.checkout_url_expires_at.toISOString(),
          };
        }

        if (
          paymentOrder &&
          paymentOrder.status !== 'FAILED' &&
          paymentOrder.status !== 'CANCELLED'
        ) {
          throw new ConflictException(
            `Cannot create checkout for payment status=${paymentOrder.status}`,
          );
        }

        const idempotencyKey = paymentOrder
          ? `stagepass:checkout:${order.id}:after:${paymentOrder.id}`
          : `stagepass:checkout:${order.id}:initial`;

        this.logger.log(`Creating Stripe checkout for order_id=${order.id}`);

        const checkoutData = await this.createCheckout(
          {
            id: order.id,
            total_price: order.total_price,
          },
          provider,
          idempotencyKey,
        );

        if (this.dateProvider.isExpired(reservationExpiresAt)) {
          throw new ConflictException(
            `Reservation expired while creating checkout for order_id=${order.id}`,
          );
        }

        const checkoutExpiresAt = this.dateProvider.unixToDate(
          checkoutData.checkout_url_expires_at,
        );

        if (
          !checkoutData.checkout_url ||
          checkoutExpiresAt.getTime() <= Date.now()
        ) {
          throw new ConflictException(
            `Stripe returned an invalid checkout session for order_id=${order.id}`,
          );
        }

        await trx.insert(schema.payment_orders).values({
          order_id: order.id,
          amount: order.total_price,
          currency: 'USD',
          provider: 'STRIPE',
          provider_reference_id: checkoutData.provider_reference_id,
          status: 'PENDING',
          checkout_url: checkoutData.checkout_url,
          checkout_url_expires_at: checkoutExpiresAt,
        });

        this.logger.log(
          `Successfully created payment for order_id=${order.id}, provider_reference_id=${checkoutData.provider_reference_id}`,
        );

        return this.createPendingResponse(checkoutData);
      });
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to create or retrieve checkout for order_id=${order_id}, user_id=${user_id}`,
        err.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to pay order');
    }
  }

  private pendingResponseFromPaymentOrder(
    paymentOrder: any,
  ): PayOrderCheckoutResponseDto {
    return {
      status: 'PENDING',
      receipt_url: paymentOrder.receipt_url,
      provider: PaymentProviders.STRIPE,
      checkout_url: paymentOrder.checkout_url,
      checkout_url_expires_at:
        paymentOrder.checkout_url_expires_at.toISOString(),
    };
  }

  async findOrderEmailTemplateDataById(
    order_id: string,
  ): Promise<OrderEmailTemplateData> {
    const data =
      await this.ordersRepository.findOrderEmailTemplateDataById(order_id);

    if (!data) {
      throw new Error(
        `No order email template data found for order_id=${order_id}`,
      );
    }

    return {
      ...data,
      order_total: currencyFormatter(Number(data.order_total)),
      event_date: dateFormatter(data.event_date, data.event_timezone),
    };
  }
}
