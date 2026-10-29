import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient } from '@aws-sdk/client-sqs';

import { SqsPollingService } from './sqs-polling.service';

@Module({
  providers: [
    {
      provide: SQSClient,
      useFactory: (configService: ConfigService) => {
        return new SQSClient({
          region: configService.getOrThrow<string>('aws.region'),
        });
      },
      inject: [ConfigService],
    },
    SqsPollingService,
  ],
  exports: [SQSClient, SqsPollingService],
})
export class SqsModule {}
