import { SendEmailMessageDto } from '@/modules/emails/dtos/send-email-message.dto';

export abstract class IEmailsMessageProducer {
  abstract emit(payload: SendEmailMessageDto): void;
}
