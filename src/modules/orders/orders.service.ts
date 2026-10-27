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
import { and, count, eq, inArray } from 'drizzle-orm';

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
      const order = await this.findOneElseThrow(order_id);

      if (user_id !== order.user_id) {
        this.logger.error(`User ${user_id} does not own order ${order.id}`);
        throw new ForbiddenException(`User does not own order!`);
      }

      const eventTicket = await this.eventsService.findEventTicketByIdElseThrow(
        createOrderItemDto.event_ticket_id,
      );

      if (order.event_id !== eventTicket.event_id) {
        this.logger.error(
          `event_ticket_id=${eventTicket.id} does not belong to order=${order.id} !`,
        );
        throw new BadRequestException(
          `Event ticket does not belong to order event!`,
        );
      }

      if (eventTicket.sold || eventTicket.amount <= 0) {
        this.logger.error(`Event ticket ${eventTicket.id} is sold out!`);
        throw new BadRequestException('Tickets for this event is sold out!');
      }

      const orderItem = await this.ordersRepository.insertOrderItem({
        order_id: order.id,
        event_ticket_id: eventTicket.id,
        unit_price: eventTicket.price,
        owner_email: createOrderItemDto.owner_email,
        owner_name: createOrderItemDto.owner_name,
      });

      this.logger.log(`Succesfully created order item ${orderItem.id}`);

      return this.ordersMapper.mapOrderItemEntityToOrderItemResponseDto(
        await this.ordersRepository.findOrderItemByOrderId(orderItem.order_id),
      );
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed to create order item user_id=${user_id}, order_id=${order_id} event_ticket_id=${createOrderItemDto.event_ticket_id}!`,
        e?.stack,
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
      const order = await this.findOneElseThrow(order_id);

      if (user_id !== order.user_id) {
        this.logger.error(`User ${user_id} does not own order ${order.id}`);
        throw new ForbiddenException(`User does not own order!`);
      }

      if (order.status !== 'PENDING') {
        this.logger.error(
          'Order items can only be removed when order status is PENDING',
        );
        throw new UnprocessableEntityException(
          'Order items can only be removed when order status is PENDING',
        );
      }

      const orderItem = await this.findOneItemElseThrow(order_item_id);

      if (order.id !== orderItem.order_id) {
        this.logger.error(
          `Order item ${orderItem.id} is not related to order ${order.id}`,
        );
        throw new ForbiddenException(
          `Order item should be related to the order`,
        );
      }

      await this.ordersRepository.deleteOrderItemById(orderItem.id);
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed to delete order item user_id=${user_id}, order_id=${order_id}, order_item_id=${order_item_id}`,
        e?.stack,
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
      const order = await this.findOneElseThrow(order_id);

      if (order.status !== 'PENDING') {
        this.logger.error(
          'Orders can only be confirmed when order status is PENDING',
        );
        throw new UnprocessableEntityException(
          'Orders can only be confirmed when order status is PENDING',
        );
      }

      if (user_id !== order.user_id) {
        this.logger.error(`User ${user_id} does not own order ${order.id}`);
        throw new ForbiddenException(`User does not own order!`);
      }

      const result = await this.drizzle.transaction(async (tx) => {
        const order = await tx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, order_id))
          .for('update');

        const orderItems = await tx
          .select({
            id: schema.order_item.id,
            event_ticket_id: schema.order_item.event_ticket_id,
            unit_price: schema.order_item.unit_price,
          })
          .from(schema.order_item)
          .where(eq(schema.order_item.order_id, order_id));

        if (orderItems.length === 0) {
          throw new UnprocessableEntityException(
            'Order must contain at least one item',
          );
        }

        const eventTicketAmmountToBuy = new Map<string, number>();

        for (const item of orderItems) {
          if (!item.event_ticket_id) continue;

          const amount =
            (eventTicketAmmountToBuy.get(item.event_ticket_id) ?? 0) + 1;

          eventTicketAmmountToBuy.set(item.event_ticket_id, amount);
        }

        const eventTicketIds = [...eventTicketAmmountToBuy.keys()];

        const eventTickets = await tx
          .select()
          .from(schema.event_tickets)
          .where(inArray(schema.event_tickets.id, eventTicketIds))
          .for('update');

        const ticketsReserved = await tx
          .select({
            event_ticket_id: schema.event_ticket_reservations.event_ticket_id,
            reserved: count(schema.event_ticket_reservations.event_ticket_id),
          })
          .from(schema.event_ticket_reservations)
          .where(
            and(
              eq(schema.event_ticket_reservations.active, true),
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
            reservation.reserved,
          );
        }

        for (const ticket of eventTickets) {
          const ammountToBuy = eventTicketAmmountToBuy.get(ticket.id);
          const availableAmmount =
            ticket.amount - ticketsReservedMap.get(ticket.id);

          if (ammountToBuy > availableAmmount) {
            this.logger.error(
              `Tickets not available for order=${order[0].id}, user_id=${user_id}, ${ticket.id}`,
            );
            throw new ConflictException(
              `Amount of ${ammountToBuy} not available for ticket ${ticket.id}`,
            );
          }
        }

        const expiresAt = new Date(
          Date.now() + this.RESERVATION_EXPIRES_AT_IN_MIN,
        );

        const reservations = orderItems.map((item) => {
          return {
            order_id: order[0].id,
            order_item_id: item.id,
            event_ticket_id: item.event_ticket_id,
            expires_at: expiresAt,
            active: true,
          };
        });

        await tx.insert(schema.event_ticket_reservations).values(reservations);

        const totalPrice = orderItems.reduce((acc, item) => {
          return acc + item.unit_price;
        }, 0);

        const updatedOrder = await tx
          .update(schema.orders)
          .set({
            reservation_expires_at: expiresAt,
            status: 'AWAITING_PAYMENT',
            total_price: totalPrice,
          })
          .where(eq(schema.orders.id, order_id))
          .returning();

        return updatedOrder[0];
      });

      return result;
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed to confirm order user_id=${user_id}, order_id=${order_id}`,
        e?.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to confirm order');
    }
  }

  private async createCheckout(
    order: { id: string; total_price: number },
    provider: PaymentProviders,
  ) {
    switch (provider) {
      case PaymentProviders.STRIPE:
        return this.paymentGateway.process({
          order_id: order.id,
          amount: order.total_price,
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
      checkout_url_expires_at: this.toCheckoutExpiresAtString(
        checkout.checkout_url_expires_at,
        'America/Sao_Paulo',
      ),
    };
  }

  private toCheckoutExpiresAtDate(
    unixSeconds: number,
    tz = 'America/Sao_Paulo',
  ): Date {
    return new Date(this.dateProvider.unixToTimestampTz(unixSeconds, tz));
  }

  private toCheckoutExpiresAtString(
    unixSeconds: number,
    tz = 'America/Sao_Paulo',
  ): string {
    return this.dateProvider.unixToTimestampTz(unixSeconds, tz);
  }

  async payOrder(
    user_id: string,
    order_id: string,
    pay_order_dto: PayOrderDto,
  ): Promise<PayOrderCheckoutResponseDto> {
    try {
      const order = await this.findOneElseThrow(order_id);

      if (order.status === 'PAID') {
        const paymentOrder =
          await this.paymentOrdersService.findLastPaymentOrderByOrderBy(
            order.id,
          );

        return {
          status: 'SUCCEEDED',
          receipt_url: paymentOrder.receipt_url,
          provider: paymentOrder.provider as PaymentProviders,
          checkout_url: null,
          checkout_url_expires_at: String(paymentOrder.checkout_url_expires_at),
        };
      }

      if (this.dateProvider.isExpired(String(order.reservation_expires_at))) {
        this.logger.error(`Order ${order.id} reservation is expired!`);
        throw new ConflictException(`Can not pay an expired order!`);
      }

      if (user_id !== order.user_id) {
        this.logger.error(`User ${user_id} does not own order ${order.id}`);
        throw new ForbiddenException(`User does not own order!`);
      }

      if (order.status !== 'AWAITING_PAYMENT') {
        this.logger.error(
          'Order items can only be paid when order status is AWAITING_PAYMENT',
        );
        throw new UnprocessableEntityException(
          'Order items can only be paid when order status is AWAITING_PAYMENT',
        );
      }

      this.logger.log(
        `Init order payment via ${pay_order_dto.payment_provider} provider!`,
      );

      const paymentOrder =
        await this.paymentOrdersService.findLastPaymentOrderByOrderBy(order.id);

      if (!paymentOrder) {
        const checkoutData = await this.createCheckout(
          order,
          PaymentProviders[pay_order_dto.payment_provider],
        );

        await this.paymentOrdersService.create({
          order_id: order.id,
          amount: order.total_price,
          currency: 'USD',
          provider: PaymentProviders.STRIPE,
          provider_reference_id: checkoutData.provider_reference_id,
          status: 'PENDING',
          checkout_url: checkoutData.checkout_url,
          checkout_url_expires_at: this.toCheckoutExpiresAtDate(
            checkoutData.checkout_url_expires_at,
            'America/Sao_Paulo',
          ),
        });

        return this.createPendingResponse(checkoutData);
      }

      if (
        paymentOrder.status === 'PENDING' &&
        this.dateProvider.isExpired(
          String(paymentOrder.checkout_url_expires_at),
        )
      ) {
        paymentOrder.status = 'FAILED';

        const checkoutData = await this.createCheckout(
          order,
          PaymentProviders[pay_order_dto.payment_provider],
        );

        await this.paymentOrdersService.updateAndCreateNewPaymentOrderTransaction(
          checkoutData,
          paymentOrder,
        );

        return this.createPendingResponse(checkoutData);
      }

      if (paymentOrder.status === 'PENDING') {
        return this.pendingResponseFromPaymentOrder(paymentOrder);
      }

      const shouldCreateNewOrderPaymentStatuses = new Set([
        'CANCELLED',
        'FAILED',
      ]);

      if (shouldCreateNewOrderPaymentStatuses.has(paymentOrder.status)) {
        const checkoutData = await this.createCheckout(
          order,
          PaymentProviders[pay_order_dto.payment_provider],
        );

        await this.paymentOrdersService.create({
          order_id: order.id,
          amount: order.total_price,
          currency: 'USD',
          provider: PaymentProviders.STRIPE,
          provider_reference_id: checkoutData.provider_reference_id,
          status: 'PENDING',
          checkout_url: checkoutData.checkout_url,
          checkout_url_expires_at: this.toCheckoutExpiresAtDate(
            checkoutData.checkout_url_expires_at,
            'America/Sao_Paulo',
          ),
        });

        return this.createPendingResponse(checkoutData);
      }

      if (paymentOrder.status === 'SUCCEEDED') {
        return {
          receipt_url: paymentOrder.receipt_url,
          status: 'SUCCEEDED',
          provider: PaymentProviders[paymentOrder.provider],
          checkout_url: null,
          checkout_url_expires_at: null,
        };
      }

      throw new InternalServerErrorException('Unhandled payment order status');
    } catch (error) {
      const e = error as Error;

      this.logger.error(
        `Failed to pay for order order_id=${order_id}, item user_id=${user_id}`,
        e?.stack,
      );

      if (error instanceof HttpException) throw error;

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
      event_date: dateFormatter(data.event_date),
    };
  }
}
