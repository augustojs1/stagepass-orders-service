import { Injectable } from '@nestjs/common';

import { OrderItemEntity, OrdersEntity } from '../models';
import { CreateOrderResponseDto, OrderItemResponseDto } from '../dto';

@Injectable()
export class OrdersMapper {
  mapOrderEntityToCreateOrderReponseDto(
    orderEntity: OrdersEntity,
  ): CreateOrderResponseDto {
    return {
      id: orderEntity.id,
      event_id: orderEntity.event_id,
      user_id: orderEntity.user_id,
      total_price: orderEntity.total_price,
      status: orderEntity.status,
      reservation_expires_at: orderEntity.reservation_expires_at,
      updated_at: orderEntity.updated_at,
      created_at: orderEntity.created_at,
    };
  }

  mapOrderItemEntityToOrderItemResponseDto(
    orderItemsEntity: OrderItemEntity[],
  ): OrderItemResponseDto[] {
    return orderItemsEntity.map((item) => {
      return {
        id: item.id,
        order_id: item.order_id,
        event_ticket_id: item.event_ticket_id,
        owner_name: item.owner_name,
        owner_email: item.owner_email,
        unit_price: item.unit_price,
        updated_at: item.updated_at,
        created_at: item.created_at,
      };
    });
  }
}
