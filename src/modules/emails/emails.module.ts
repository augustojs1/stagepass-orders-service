import { Module } from '@nestjs/common';

import { EmailsService } from './email.service';
import { SMTPModule } from '@/infra/smtp/smtp.module';
import { SMTPService } from '@/infra/smtp/smtp.service.interface';
import { EtherealSMTPService } from '@/infra/smtp/impl/ethereal-smtp.service';
import { TicketsModule } from '../tickets/tickets.module';
import { EmailTemplatesRepository } from './email-templates.repository';
import { EmailTemplateRendererProvider } from './providers/email-template-renderer.provider';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [SMTPModule, TicketsModule, OrdersModule],
  providers: [
    {
      provide: SMTPService,
      useClass: EtherealSMTPService,
    },
    EmailsService,
    EmailTemplatesRepository,
    EmailTemplateRendererProvider,
  ],
  exports: [EmailsService],
})
export class EmailsModule {}
