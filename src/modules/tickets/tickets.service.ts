import { Injectable } from '@nestjs/common';

import { TicketsRepository } from './tickets.repository';

@Injectable()
export class TicketsService {
  constructor(private readonly ticketsRepository: TicketsRepository) {}

  async findTicketAndUserByOrderId(order_id: string) {
    return await this.ticketsRepository.findTicketAndUserByOrderId(order_id);
  }
}
