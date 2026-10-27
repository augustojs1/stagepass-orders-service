import { Injectable, Logger } from '@nestjs/common';

import { SMTPService } from '@/infra/smtp/smtp.service.interface';
import { EmailTemplateType } from './enums/email-template-type.enum';
import { SendEmailMessageDto } from './dtos/send-email-message.dto';
import { TicketsService } from '../tickets/tickets.service';
import { EmailTemplatesRepository } from './email-templates.repository';
import { EmailTemplateRendererProvider } from './providers/email-template-renderer.provider';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    private readonly smtpService: SMTPService,
    private readonly ticketsService: TicketsService,
    private readonly emailTemplatesRepository: EmailTemplatesRepository,
    private readonly emailTemplateRendererProvider: EmailTemplateRendererProvider,
    private readonly ordersService: OrdersService,
  ) {}

  async sendTransactionalEmail(payload: SendEmailMessageDto): Promise<void> {
    switch (payload.type) {
      case EmailTemplateType.TICKETS_AVAILABLE:
        return await this.sendTicketsAvailableEmail(payload);
      case EmailTemplateType.PAYMENT_SUCCESS:
        return await this.sendPaymentSuccessEmail(payload);
      case EmailTemplateType.PAYMENT_FAILED:
        return await this.sendPaymentFailedEmail(payload);
      default:
        throw new Error(`Unsupported email type: ${payload.type}`);
    }
  }

  async sendPaymentFailedEmail(payload: SendEmailMessageDto): Promise<void> {
    try {
      const emailTemplate = await this.emailTemplatesRepository.findByType(
        payload.type,
      );

      const data = await this.ordersService.findOrderEmailTemplateDataById(
        payload.order_id,
      );

      const html = this.emailTemplateRendererProvider.render(
        emailTemplate.html,
        data,
      );

      await this.smtpService.sendEmail({
        to: payload.to,
        subject: `Payment for order #${payload.order_id} has failed!`,
        html: html,
      });

      this.logger.log(
        `Successfully sent payment failed for email=${payload.to}, order_id=${payload.order_id}, type=${payload.type}`,
      );
    } catch (error) {
      this.logger.error(
        `An error has occured while trying to send payment failed via email: email=${payload.to}, order_id=${payload.order_id}, type=${payload.type}`,
        error,
      );

      throw error;
    }
  }

  async sendPaymentSuccessEmail(payload: SendEmailMessageDto): Promise<void> {
    try {
      const emailTemplate = await this.emailTemplatesRepository.findByType(
        payload.type,
      );

      const data = await this.ordersService.findOrderEmailTemplateDataById(
        payload.order_id,
      );

      const html = this.emailTemplateRendererProvider.render(
        emailTemplate.html,
        data,
      );

      await this.smtpService.sendEmail({
        to: payload.to,
        subject: `Payment for order #${payload.order_id} was successful!`,
        html: html,
      });

      this.logger.log(
        `Successfully sent payment success for email=${payload.to}, order_id=${payload.order_id}, type=${payload.type}`,
      );
    } catch (error) {
      this.logger.error(
        `An error has occured while trying to send payment success via email: email=${payload.to}, order_id=${payload.order_id}, type=${payload.type}`,
        error,
      );

      throw error;
    }
  }

  async sendTicketsAvailableEmail(payload: SendEmailMessageDto): Promise<void> {
    try {
      const emailTemplate = await this.emailTemplatesRepository.findByType(
        payload.type,
      );

      const data = await this.ordersService.findOrderEmailTemplateDataById(
        payload.order_id,
      );

      const html = this.emailTemplateRendererProvider.render(
        emailTemplate.html,
        data,
      );

      const usersAndTickets =
        await this.ticketsService.findTicketAndUserByOrderId(payload.order_id);

      await this.smtpService.sendEmail({
        to: payload.to,
        subject: `Tickets for order #${payload.order_id}`,
        html: html,
        attachments: usersAndTickets.map((ticket) => ({
          filename: `${ticket.ticket_code}.pdf`,
          path: ticket.ticket_file_url,
        })),
      });

      this.logger.log(
        `Successfully sent tickets for email=${payload.to}, order_id=${payload.order_id}, type=${payload.type}`,
      );
    } catch (error) {
      this.logger.error(
        `An error has occured while trying to send tickets via email: email=${payload.to}, order_id=${payload.order_id}, type=${payload.type}`,
        error,
      );

      throw error;
    }
  }
}
