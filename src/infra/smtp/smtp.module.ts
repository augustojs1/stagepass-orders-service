import { Module } from '@nestjs/common';

import { SMTPService } from './smtp.service.interface';
import { EtherealSMTPService } from './impl/ethereal-smtp.service';

@Module({
  providers: [
    {
      provide: SMTPService,
      useClass: EtherealSMTPService,
    },
  ],
  exports: [SMTPService],
})
export class SMTPModule {}
