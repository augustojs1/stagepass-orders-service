export interface HttpClientService {
  putBinary(
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
  ): Promise<void>;
}
