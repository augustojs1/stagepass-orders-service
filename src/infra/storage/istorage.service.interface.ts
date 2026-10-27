export abstract class IStorageService {
  abstract upload(file: any, path: string): Promise<string>;
  abstract remove(key: string): Promise<void>;
}
