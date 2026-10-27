import { Injectable, Logger } from '@nestjs/common';

import { TicketsService } from '@/modules/tickets/tickets.service';
import { ITicketsEventsConsumer } from '../interfaces/itickets-events.consumer';

@Injectable()
export class TicketsMessageSqsConsumer implements ITicketsEventsConsumer {
  private readonly logger = new Logger(TicketsMessageSqsConsumer.name);

  constructor(private readonly ticketsService: TicketsService) {}

  async handle(payload: { order_id: string }): Promise<void> {
    this.logger.log(
      `Received ticket generation message for order_id=${payload.order_id}`,
    );

    try {
      await this.ticketsService.handleGenerate(payload.order_id);

      this.logger.log(
        `Successfully generated tickets for order_id=${payload.order_id}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to generate tickets for order_id=${payload.order_id}`,
        err.stack,
      );

      throw error;
    }
  }
}
