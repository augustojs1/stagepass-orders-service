import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESv2Client,
  SendEmailCommand,
  Attachment,
} from '@aws-sdk/client-sesv2';

import { SMTPService } from '../smtp.service.interface';
import { SendEmailPayload } from '../models/send-email-payload.model';

@Injectable()
export class SESService implements SMTPService {
  private readonly logger = new Logger(SESService.name);

  private readonly client: SESv2Client;
  private readonly MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

  constructor(private readonly configService: ConfigService) {
    this.client = new SESv2Client({
      region: this.configService.getOrThrow<string>('aws.region'),
    });

    this.logger.log('Successfully initialized AWS SES client.');
  }

  async sendEmail(options: SendEmailPayload): Promise<void> {
    try {
      const attachments = await this.prepareAttachments(
        options.attachments ?? [],
      );

      const command = new SendEmailCommand({
        FromEmailAddress:
          this.configService.getOrThrow<string>('aws.ses.email_from'),
        Destination: {
          ToAddresses: [options.to],
        },
        Content: {
          Simple: {
            Subject: {
              Data: options.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: options.html,
                Charset: 'UTF-8',
              },
            },
            ...(attachments.length > 0 && {
              Attachments: attachments,
            }),
          },
        },
      });

      const response = await this.client.send(command);

      this.logger.log(
        `Email accepted by SES: to=${options.to}, messageId=${response.MessageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email via SES: to=${options.to}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  private async prepareAttachments(
    attachments: NonNullable<SendEmailPayload['attachments']>,
  ): Promise<Attachment[]> {
    return Promise.all(
      attachments.map(async (attachment): Promise<Attachment> => {
        const url = new URL(attachment.path);

        if (url.protocol !== 'https:') {
          throw new Error(
            `Invalid attachment URL protocol: ${attachment.filename}`,
          );
        }

        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch attachment ${attachment.filename}: HTTP ${response.status}`,
          );
        }

        const declaredSize = Number(response.headers.get('content-length'));

        if (
          Number.isFinite(declaredSize) &&
          declaredSize > this.MAX_ATTACHMENT_SIZE
        ) {
          await response.body?.cancel();

          throw new Error(
            `Attachment exceeds maximum size: ${attachment.filename}`,
          );
        }

        const chunks: Uint8Array[] = [];
        let totalSize = 0;

        if (!response.body) {
          throw new Error(
            `Empty response body for attachment: ${attachment.filename}`,
          );
        }

        for await (const chunk of response.body) {
          totalSize += chunk.byteLength;

          if (totalSize > this.MAX_ATTACHMENT_SIZE) {
            await response.body.cancel().catch(() => undefined);

            throw new Error(
              `Attachment exceeds maximum size: ${attachment.filename}`,
            );
          }

          chunks.push(chunk);
        }

        const content = Buffer.concat(chunks, totalSize);

        this.logger.debug(
          `Successfully downloaded attachment: ${attachment.filename}`,
        );

        return {
          FileName: attachment.filename,
          ContentType: 'application/pdf',
          ContentDisposition: 'ATTACHMENT',
          RawContent: content,
        };
      }),
    );
  }
}
