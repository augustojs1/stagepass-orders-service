import { PreSignedResponse } from './models';

export abstract class ICloudStorageService {
  abstract getObject(key: string): Promise<void>;
  abstract createPresignedUploadUrl(
    key: string,
    expiresIn: number,
    contentType: string,
  ): Promise<PreSignedResponse>;
  abstract removeObject(key: string): Promise<void>;
}
