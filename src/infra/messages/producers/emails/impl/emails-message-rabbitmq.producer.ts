import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { IEmailsMessageProducer } from '../interfaces/iemails-message-producer.interface';
import { MessageQueues } from '@/infra/messages/consumers/enums';
import { SendEmailMessageDto } from '@/modules/emails/dtos/send-email-message.dto';

@Injectable()
export class EmailsMessageRabbitMqProducer implements IEmailsMessageProducer {
  private readonly logger = new Logger(EmailsMessageRabbitMqProducer.name);

  constructor(
    @Inject('email_queue')
    private readonly rabbitMqClient: ClientProxy,
  ) {}

  emit(payload: SendEmailMessageDto) {
    this.rabbitMqClient.emit(MessageQueues.EMAIL, payload);

    this.logger.log(`Publish message on queue ${MessageQueues.EMAIL}.`);
  }
}
