import { Inject, Injectable } from '@nestjs/common';
import { count, eq, ExtractTablesWithRelations, sql } from 'drizzle-orm';
import {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
import { PgTransaction } from 'drizzle-orm/pg-core';

import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { OrdersEntity } from '@/modules/orders/models/orders-entity.model';
import { TicketData } from '../tickets/models';
import { OrderEmailTemplateData } from '../emails/models';
import { InsertOrderParams } from './models/insert-order-params.model';
import { OrderEventTickets, OrderItemEntity } from './models';
import { InsertOrdemItemParams } from './models/insert-order-item-params';

@Injectable()
export class OrdersRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async insertOrder(
    inserOrderParams: InsertOrderParams,
  ): Promise<OrdersEntity> {
    const order = await this.drizzle
      .insert(schema.orders)
      .values({
        event_id: inserOrderParams.event_id,
        user_id: inserOrderParams.user_id,
        status: 'PENDING',
        total_price: 0,
        reservation_expires_at: null,
      })
      .returning();

    return order[0];
  }

  async findOneById(order_id: string): Promise<OrdersEntity | null> {
    const order = await this.drizzle
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, order_id));

    return order[0] ?? null;
  }

  async insertOrderItem(
    inserOrderItemParams: InsertOrdemItemParams,
  ): Promise<OrderItemEntity> {
    const orderItem = await this.drizzle
      .insert(schema.order_item)
      .values({
        order_id: inserOrderItemParams.order_id,
        event_ticket_id: inserOrderItemParams.event_ticket_id,
        owner_name: inserOrderItemParams.owner_name,
        owner_email: inserOrderItemParams.owner_email,
        unit_price: inserOrderItemParams.unit_price,
      })
      .returning();

    return orderItem[0];
  }

  async findOneOrderItemById(
    order_item_id: string,
  ): Promise<OrderItemEntity | null> {
    const orderItem = await this.drizzle
      .select()
      .from(schema.order_item)
      .where(eq(schema.order_item.id, order_item_id));

    return orderItem[0] ?? null;
  }

  async findOrderItemByOrderId(order_id: string): Promise<OrderItemEntity[]> {
    const orderItems = await this.drizzle
      .select()
      .from(schema.order_item)
      .where(eq(schema.order_item.order_id, order_id));

    return orderItems;
  }

  async deleteOrderItemById(order_item_id: string): Promise<void> {
    await this.drizzle
      .delete(schema.order_item)
      .where(eq(schema.order_item.id, order_item_id));
  }

  async findOrderEventTicketsById(
    order_id: string,
  ): Promise<OrderEventTickets[]> {
    const orderEventTickets = await this.drizzle
      .select({
        order_id: schema.orders.id,
        event_ticket_id: schema.event_tickets.id,
        ticket_name: schema.event_tickets.name,
        ticket_sold: schema.event_tickets.sold,
        ticket_amount: schema.event_tickets.amount,
        ticket_price: schema.event_tickets.price,
      })
      .from(schema.orders)
      .innerJoin(
        schema.order_item,
        eq(schema.order_item.order_id, schema.orders.id),
      )
      .innerJoin(
        schema.event_tickets,
        eq(schema.event_tickets.id, schema.order_item.event_ticket_id),
      )
      .where(eq(schema.orders.id, order_id));

    return orderEventTickets;
  }

  async update(order: OrdersEntity): Promise<void> {
    await this.drizzle
      .update(schema.orders)
      .set({
        ...order,
      })
      .where(eq(schema.orders.id, order.id));
  }

  async updateByProviderReferenceIdTrx(
    trx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    orderEntity: Partial<OrdersEntity>,
  ): Promise<void> {
    // await trx
    //           .update(schemas.orders)
    //           .set({
    //             status: 'PAID',
    //           })
    //           .where(eq(schemas.orders.id, payload.order_id));

    await trx
      .update(schema.orders)
      .set({
        status: orderEntity.status,
      })
      .where(eq(schema.orders.id, orderEntity.id));
  }

  async getTicketsByOrderId(
    trx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    order_id: string,
  ): Promise<
    {
      ticket_id: string;
      ticket_amount: number;
    }[]
  > {
    // const eventTicketsOrder = await trx
    //           .select({
    //             ticket_id: schemas.event_tickets.id,
    //             ticket_amount: schemas.event_tickets.amount,
    //           })
    //           .from(schemas.order_item)
    //           .innerJoin(
    //             schemas.event_tickets,
    //             eq(schemas.event_tickets.id, schemas.order_item.event_ticket_id),
    //           )
    //           .where(eq(schemas.order_item.order_id, payload.order_id));

    const result = await trx
      .select({
        ticket_id: schema.event_tickets.id,
        ticket_amount: schema.event_tickets.amount,
      })
      .from(schema.order_item)
      .innerJoin(
        schema.event_tickets,
        eq(schema.event_tickets.id, schema.order_item.event_ticket_id),
      )
      .where(eq(schema.order_item.order_id, order_id));

    return result;
  }

  async findById(order_id: string): Promise<OrdersEntity | null> {
    const result = await this.drizzle
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, order_id));

    return result[0] ?? null;
  }

  async findByIdTrx(
    trx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    order_id: string,
  ): Promise<OrdersEntity | null> {
    const result = await trx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, order_id));

    return result[0] ?? null;
  }

  async findOrderAndOrderItemAndEventById(id: string): Promise<TicketData[]> {
    const result = await this.drizzle
      .select({
        event_name: schema.events.name,
        owner_id: schema.users.id,
        order_owner_email: schema.users.email,
        order_id: schema.order_item.order_id,
        order_item_id: schema.order_item.id,
        event_ticket_id: schema.event_tickets.id,
        starts_at: schema.events.starts_at,
        address_number: schema.events.address_number,
        address_district: schema.events.address_district,
        address_street: schema.events.address_street,
        address_city: schema.events.address_city,
        owner_name: schema.order_item.owner_name,
        owner_email: schema.order_item.owner_email,
        unit_price: schema.order_item.unit_price,
      })
      .from(schema.order_item)
      .innerJoin(
        schema.orders,
        eq(schema.orders.id, schema.order_item.order_id),
      )
      .innerJoin(schema.users, eq(schema.users.id, schema.orders.user_id))
      .innerJoin(
        schema.event_tickets,
        eq(schema.event_tickets.id, schema.order_item.event_ticket_id),
      )
      .innerJoin(
        schema.events,
        eq(schema.events.id, schema.event_tickets.event_id),
      )
      .where(eq(schema.order_item.order_id, id));

    return result;
  }

  async findOrderUserEmail(order_id: string): Promise<string | null> {
    const result = await this.drizzle
      .select({
        email: schema.users.email,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.user_id, schema.users.id))
      .where(eq(schema.orders.id, order_id));

    return result[0].email ?? null;
  }

  async findOrderEmailTemplateDataById(
    order_id: string,
  ): Promise<OrderEmailTemplateData | null> {
    const result = await this.drizzle
      .select({
        customer_name: schema.users.first_name,
        order_id: schema.orders.id,
        tickets_count: count(schema.order_item.id),
        order_total: schema.orders.total_price,
        event_name: schema.events.name,
        event_date: schema.events.starts_at,
        event_location: sql<string>`
        concat(
          ${schema.events.address_street}, ', ',
          ${schema.events.address_number}, ', ',
          ${schema.events.address_district}, ' - ',
          ${schema.events.address_city}
        )
      `,
        receipt_url: schema.payment_orders.receipt_url,
        checkout_url: schema.payment_orders.checkout_url,
        payment_status: schema.payment_orders.status,
        error_message: schema.payment_orders.error_message,
        current_year: sql<number>`extract(year from now())`,
      })
      .from(schema.orders)
      .innerJoin(
        schema.order_item,
        eq(schema.order_item.order_id, schema.orders.id),
      )
      .innerJoin(
        schema.payment_orders,
        eq(schema.payment_orders.order_id, schema.orders.id),
      )
      .innerJoin(schema.events, eq(schema.events.id, schema.orders.event_id))
      .innerJoin(schema.users, eq(schema.users.id, schema.orders.user_id))
      .where(eq(schema.orders.id, order_id))
      .groupBy(
        schema.users.first_name,
        schema.orders.id,
        schema.orders.total_price,
        schema.events.name,
        schema.events.starts_at,
        schema.events.address_street,
        schema.events.address_number,
        schema.events.address_district,
        schema.events.address_city,
        schema.payment_orders.receipt_url,
        schema.payment_orders.checkout_url,
        schema.payment_orders.status,
        schema.payment_orders.error_message,
      );

    return result[0] ?? null;
  }
}
