type SendEmailAttachment = {
  filename: string;
  path: string;
};

export type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
  attachments?: SendEmailAttachment[];
};
