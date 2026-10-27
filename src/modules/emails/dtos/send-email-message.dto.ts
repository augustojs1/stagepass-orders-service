import { EmailTemplateType } from '../enums/email-template-type.enum';

export type SendEmailMessageDto = {
  type: EmailTemplateType;
  order_id: string;
  to: string;
};
