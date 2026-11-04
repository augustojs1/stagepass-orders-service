import {
  CheckoutSessionData,
  OrderPaymentPayload,
} from '@/infra/payment-gateway/stripe/models';

export abstract class IPaymentGateway {
  abstract process(data: OrderPaymentPayload): Promise<CheckoutSessionData>;
  abstract handleEvent(body: any, signature: any): Promise<void>;
  abstract handleSuccessEvent(event: any): Promise<void>;
  abstract handleFailedEvent(event: any): Promise<void>;
  abstract expireCheckoutSession(
    sessionId: string,
  ): Promise<'EXPIRED' | 'PAID' | 'UNRESOLVED'>;
}
