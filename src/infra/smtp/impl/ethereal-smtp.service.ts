import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

import { SMTPService } from '../smtp.service.interface';
import { SendEmailPayload } from '../models/send-email-payload.model';

@Injectable()
export class EtherealSMTPService implements SMTPService, OnModuleInit {
  private readonly logger = new Logger(EtherealSMTPService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('ETHEREAL_HOST'),
      port: this.configService.get<number>('ETHEREAL_PORT'),
      auth: {
        user: this.configService.get<string>('ETHEREAL_USERNAME'),
        pass: this.configService.get<string>('ETHEREAL_PASSWORD'),
      },
    });

    this.logger.log('Init Ethereal email transporter.');
  }

  async sendEmail(options: SendEmailPayload): Promise<void> {
    const data = await this.transporter.sendMail({
      from: this.configService.get<string>('EMAIL_FROM'),
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    this.logger.log(`Email sent to ${options.to}`);

    const previewUrl = nodemailer.getTestMessageUrl(data);

    if (previewUrl) {
      this.logger.log(`Email preview URL: ${previewUrl}`);
    }
  }
}
