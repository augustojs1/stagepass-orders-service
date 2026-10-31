import { Module } from '@nestjs/common';

import { SMTPService } from './smtp.service.interface';
import { SESService } from './ses/ses.service';

@Module({
  providers: [
    {
      provide: SMTPService,
      useClass: SESService,
    },
  ],
  exports: [SMTPService],
})
export class SMTPModule {}
