import { WebhookPaymentStatus } from '../enum/webhook-payment-status.enum';
import { WebhookProcessStatus } from '../enum/webhook-process-statuses.enum';
import { PaymentProviders } from './payment-gateway-webhook-events-entity.model';

export class InsertPaymentGatewayWebhookEventParams {
  order_id: string;
  provider: PaymentProviders;
  provider_reference_id: string;
  payment_status: WebhookPaymentStatus;
  process: WebhookProcessStatus;
  event_created_at: number;
  amount_total: number;
  expires_at: number;
  currency: string;
  receipt_url?: string;
  error_code?: string;
  error_message?: string;
  error_decline_code?: string;
}
