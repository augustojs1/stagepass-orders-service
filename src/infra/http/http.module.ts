import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AxiosHttpClientService } from '@/infra/http/impl/axios/axios-http-client.service';

export const HTTP_UPLOADER = Symbol('HTTP_UPLOADER');

@Module({
  imports: [HttpModule],
  providers: [
    AxiosHttpClientService,
    {
      provide: HTTP_UPLOADER,
      useExisting: AxiosHttpClientService,
    },
  ],
  exports: [HTTP_UPLOADER],
})
export class AppHttpModule {}
