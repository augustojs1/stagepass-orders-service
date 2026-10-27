import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient } from '@aws-sdk/client-sqs';

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
  ],
  exports: [SQSClient],
})
export class SqsModule {}
