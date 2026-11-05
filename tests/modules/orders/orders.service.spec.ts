import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { OrdersService } from '@/modules/orders/orders.service';
import { CreateOrderDto } from '@/modules/orders/dto';

describe('OrdersService', () => {
  let service: OrdersService;

  const userId = 'user-123';
  const eventId = 'event-123';

  const createOrderDto = {
    event_id: eventId,
  } as CreateOrderDto;

  const event = {
    id: eventId,
    starts_at: new Date('2027-05-10T20:00:00Z'),
  };

  const createdOrder = {
    id: 'order-123',
    user_id: userId,
    event_id: eventId,
    status: 'PENDING',
  };

  const mappedOrder = {
    id: createdOrder.id,
    status: createdOrder.status,
  };

  let ordersRepositoryMock: {
    insertOrder: jest.Mock;
  };

  let eventsServiceMock: {
    findOneElseThrow: jest.Mock;
  };

  let dateProviderMock: {
    differenceInHours: jest.Mock;
  };

  let ordersMapperMock: {
    mapOrderEntityToCreateOrderReponseDto: jest.Mock;
  };

  beforeEach(() => {
    ordersRepositoryMock = {
      insertOrder: jest.fn(),
    };

    eventsServiceMock = {
      findOneElseThrow: jest.fn(),
    };

    dateProviderMock = {
      differenceInHours: jest.fn(),
    };

    ordersMapperMock = {
      mapOrderEntityToCreateOrderReponseDto: jest.fn(),
    };

    service = new OrdersService(
      {} as ConstructorParameters<typeof OrdersService>[0],

      ordersRepositoryMock as unknown as ConstructorParameters<
        typeof OrdersService
      >[1],

      eventsServiceMock as unknown as ConstructorParameters<
        typeof OrdersService
      >[2],

      dateProviderMock as unknown as ConstructorParameters<
        typeof OrdersService
      >[3],

      ordersMapperMock as unknown as ConstructorParameters<
        typeof OrdersService
      >[4],

      {} as ConstructorParameters<typeof OrdersService>[5],

      {} as ConstructorParameters<typeof OrdersService>[6],
    );
  });

  describe('create', () => {
    it('should create an order successfully', async () => {
      // Arrange
      eventsServiceMock.findOneElseThrow.mockResolvedValue(event);

      dateProviderMock.differenceInHours.mockReturnValue(-2);

      ordersRepositoryMock.insertOrder.mockResolvedValue(createdOrder);

      ordersMapperMock.mapOrderEntityToCreateOrderReponseDto.mockReturnValue(
        mappedOrder,
      );

      // Act
      const result = await service.create(userId, createOrderDto);

      // Assert
      expect(result).toEqual(mappedOrder);

      expect(eventsServiceMock.findOneElseThrow).toHaveBeenCalledWith(eventId);

      expect(ordersRepositoryMock.insertOrder).toHaveBeenCalledWith({
        user_id: userId,
        event_id: eventId,
      });

      expect(
        ordersMapperMock.mapOrderEntityToCreateOrderReponseDto,
      ).toHaveBeenCalledWith(createdOrder);
    });

    it('should reject an order when the event purchase deadline has passed', async () => {
      // Arrange
      eventsServiceMock.findOneElseThrow.mockResolvedValue(event);

      dateProviderMock.differenceInHours.mockReturnValue(-1);

      // Act & Assert
      await expect(service.create(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(ordersRepositoryMock.insertOrder).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when event does not exist', async () => {
      // Arrange
      eventsServiceMock.findOneElseThrow.mockRejectedValue(
        new NotFoundException('Event not found'),
      );

      // Act & Assert
      await expect(service.create(userId, createOrderDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(ordersRepositoryMock.insertOrder).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      // Arrange
      eventsServiceMock.findOneElseThrow.mockResolvedValue(event);

      dateProviderMock.differenceInHours.mockReturnValue(-2);

      ordersRepositoryMock.insertOrder.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(service.create(userId, createOrderDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should not persist an order when event validation fails', async () => {
      // Arrange
      eventsServiceMock.findOneElseThrow.mockRejectedValue(
        new BadRequestException('Invalid event'),
      );

      // Act
      await expect(service.create(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );

      // Assert
      expect(ordersRepositoryMock.insertOrder).not.toHaveBeenCalled();

      expect(
        ordersMapperMock.mapOrderEntityToCreateOrderReponseDto,
      ).not.toHaveBeenCalled();
    });
  });
});
