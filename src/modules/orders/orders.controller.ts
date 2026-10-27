import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  CreateOrderItemDto,
  CreateOrderResponseDto,
  createrOrderDtoSchema,
  createrOrderItemDtoSchema,
  OrderItemResponseDto,
  PayOrderCheckoutResponseDto,
  PayOrderDto,
  payOrderDtoSchema,
} from './dto';
import { ZodValidationPipe } from '../shared/pipes';
import { JwtAuthGuard } from '../shared/guards';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() req,
    @Body(new ZodValidationPipe(createrOrderDtoSchema))
    createOrderDto: CreateOrderDto,
  ): Promise<CreateOrderResponseDto> {
    return await this.ordersService.create(req.user.sub, createOrderDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:order_id/items')
  async createItem(
    @Req() req,
    @Param('order_id', new ParseUUIDPipe({ version: '4' })) order_id: string,
    @Body(new ZodValidationPipe(createrOrderItemDtoSchema))
    createOrderItemDto: CreateOrderItemDto,
  ): Promise<OrderItemResponseDto[]> {
    return await this.ordersService.createOrderItem(
      req.user.sub,
      order_id,
      createOrderItemDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:order_id/items/:item_id')
  async deleteItem(
    @Req() req,
    @Param('order_id', new ParseUUIDPipe({ version: '4' }))
    order_id: string,
    @Param('item_id', new ParseUUIDPipe({ version: '4' }))
    order_item_id: string,
  ) {
    return await this.ordersService.removeOrderItem(
      req.user.sub,
      order_id,
      order_item_id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:order_id/confirm')
  async confirmOrder(
    @Req() req,
    @Param('order_id', new ParseUUIDPipe({ version: '4' }))
    order_id: string,
  ): Promise<CreateOrderResponseDto> {
    return await this.ordersService.confirmOrder(req.user.sub, order_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:order_id/pay')
  async payOrder(
    @Req() req,
    @Param('order_id', new ParseUUIDPipe({ version: '4' }))
    order_id: string,
    @Body(new ZodValidationPipe(payOrderDtoSchema))
    payOrderDto: PayOrderDto,
  ): Promise<PayOrderCheckoutResponseDto> {
    return await this.ordersService.payOrder(
      req.user.sub,
      order_id,
      payOrderDto,
    );
  }
}
