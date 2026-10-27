import { Attachment } from 'nodemailer/lib/mailer';

export class SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}
