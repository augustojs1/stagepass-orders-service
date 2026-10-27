import { forwardRef, Module } from '@nestjs/common';

import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { OrdersModule } from '../orders/orders.module';
import {
  TicketPdfGeneratorProvider,
  TicketStoragePathFactory,
} from './providers';
import { S3StorageService } from '@/infra/storage';
import { AppHttpModule } from '@/infra/http/http.module';
import { MessagesModule } from '@/infra/messages/messages.module';

@Module({
  imports: [OrdersModule, AppHttpModule, forwardRef(() => MessagesModule)],
  providers: [
    TicketsService,
    TicketsRepository,
    TicketPdfGeneratorProvider,
    S3StorageService,
    TicketStoragePathFactory,
    MessagesModule,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
