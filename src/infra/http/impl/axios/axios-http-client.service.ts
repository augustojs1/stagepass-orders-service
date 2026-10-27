import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';
import { lastValueFrom } from 'rxjs';

import { HttpClientService } from '@/infra/http/http-client.service';

@Injectable()
export class AxiosHttpClientService implements HttpClientService {
  constructor(private readonly httpService: HttpService) {}

  async putBinary(
    url: string,
    body: Buffer,
    options: {
      headers: Record<string, string | number>;
      timeoutMs?: number;
      responseType?: 'text' | 'json' | 'arraybuffer';
      maxBodyLength?: number;
      maxContentLength?: number;
      validateStatus?: (status: number) => boolean;
    },
  ): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: options.headers,
      timeout: options.timeoutMs ?? 30_000,
      responseType: options.responseType ?? 'text',
      maxBodyLength: options.maxBodyLength ?? Infinity,
      maxContentLength: options.maxContentLength ?? Infinity,
      validateStatus: options.validateStatus ?? ((s) => s >= 200 && s < 300),
    };

    try {
      await lastValueFrom(this.httpService.put(url, body, config));
    } catch (err: any) {
      throw err;
    }
  }
}
