import { Inject, Injectable } from '@nestjs/common';

import { TicketsRepository } from './tickets.repository';
import { HTTP_UPLOADER } from '@/infra/http/http.module';

@Injectable()
export class TicketsService {
  constructor(
    @Inject(HTTP_UPLOADER)
    private readonly ticketsRepository: TicketsRepository,
  ) {}

  async findTicketAndUserByOrderId(order_id: string) {
    return await this.ticketsRepository.findTicketAndUserByOrderId(order_id);
  }
}
