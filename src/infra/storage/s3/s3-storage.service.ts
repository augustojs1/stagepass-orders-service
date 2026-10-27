import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  UnprocessableEntityException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { ICloudStorageService } from '@/infra/storage';
import { PreSignedResponse } from '@/infra/storage/models';

@Injectable()
export class S3StorageService implements ICloudStorageService {
  private readonly logger = new Logger(S3StorageService.name);

  private readonly s3Client: S3Client;
  private readonly bucket: string;

  private readonly MAX_OBJECT_SIZE_IN_BYTES = 7 * 1024 * 1024;

  private readonly VALID_OBJECT_CONTENT_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
  ];

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.getOrThrow<string>('aws.region'),
    });

    this.bucket = this.configService.getOrThrow<string>('aws.s3.bucket');
  }

  async createPresignedUploadUrl(
    key: string,
    expiresIn: number = 300,
    contentType: string,
  ): Promise<PreSignedResponse> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(`Successfully generated presigned URL for key=${key}`);

      return {
        key,
        uploadUrl,
        publicUrl: this.configService.get<string>('aws.s3.public_url'),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for key=${key}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        `Failed to generate presigned URL for ${key}`,
      );
    }
  }

  async getObject(key: string): Promise<void> {
    try {
      const object = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      await this.validateObjectImageFile(key, object);
    } catch (error) {
      const status =
        error instanceof Error && '$metadata' in error
          ? (
              error as Error & {
                $metadata?: { httpStatusCode?: number };
              }
            ).$metadata?.httpStatusCode
          : undefined;

      if (status === 404) {
        this.logger.warn(`File not found in S3: ${key}`);

        throw new BadRequestException(`File not found in storage: ${key}`);
      }

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to verify file in S3: ${key}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        `Failed to verify file in storage: ${key}`,
      );
    }
  }

  async removeObject(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      this.logger.log(`Successfully removed file ${key} from S3`);
    } catch (error) {
      this.logger.error(
        `Failed to remove file from S3: ${key}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        `Failed to remove file from S3: ${key}`,
      );
    }
  }

  private async validateObjectImageFile(
    key: string,
    object: HeadObjectCommandOutput,
  ): Promise<void> {
    if (!this.VALID_OBJECT_CONTENT_TYPES.includes(object.ContentType ?? '')) {
      await this.removeObject(key);

      this.logger.error(
        `Invalid content type for object ${key}: ${object.ContentType}`,
      );

      throw new UnprocessableEntityException(
        'Invalid object content type! Object should be an image file!',
      );
    }

    if (
      object.ContentLength === undefined ||
      object.ContentLength > this.MAX_OBJECT_SIZE_IN_BYTES
    ) {
      await this.removeObject(key);

      this.logger.error(
        `Invalid content length for object ${key}: ${object.ContentLength}`,
      );

      throw new UnprocessableEntityException(
        `Object shouldn't surpass ${this.MAX_OBJECT_SIZE_IN_BYTES} bytes!`,
      );
    }
  }
}
