import { Module } from '@nestjs/common';

import { EmailsService } from './email.service';
import { SMTPModule } from '@/infra/smtp/smtp.module';
import { TicketsModule } from '../tickets/tickets.module';
import { EmailTemplatesRepository } from './email-templates.repository';
import { EmailTemplateRendererProvider } from './providers/email-template-renderer.provider';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [SMTPModule, TicketsModule, OrdersModule],
  providers: [
    EmailsService,
    EmailTemplatesRepository,
    EmailTemplateRendererProvider,
  ],
  exports: [EmailsService],
})
export class EmailsModule {}
