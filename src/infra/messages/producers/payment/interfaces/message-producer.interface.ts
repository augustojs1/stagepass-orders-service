import { FailedPaymentEventPayload } from '@/infra/payment-gateway/models/failed-payment-event.model';
import { SuccessPaymentEventPayload } from '@/infra/payment-gateway/models/success-payment-event-payload.model';

export abstract class IPaymentMessageProducer {
  abstract emitSuccess(payload: SuccessPaymentEventPayload): void;
  abstract emitFailed(payload: FailedPaymentEventPayload): void;
}
