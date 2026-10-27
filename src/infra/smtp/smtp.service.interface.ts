import { SendEmailPayload } from './models/send-email-payload.model';

export abstract class SMTPService {
  abstract sendEmail(options: SendEmailPayload): Promise<void>;
}
