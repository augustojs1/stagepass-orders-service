export abstract class IPaymentEventsConsumer {
  abstract handleSuccess(data: any): Promise<void>;
  abstract handleFailed(data: any): Promise<void>;
}
