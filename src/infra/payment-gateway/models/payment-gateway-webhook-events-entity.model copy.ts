import { WebhookPaymentStatus } from '../enum/webhook-payment-status.enum';
import { WebhookProcessStatus } from '../enum/webhook-process-statuses.enum';

export const PAYMENT_PROVIDERS = ['STRIPE'] as const;

export type PaymentProviders = (typeof PAYMENT_PROVIDERS)[number];

export class PaymentGatewayWebhookEventsEntity {
  id: string;
  order_id: string;
  provider: PaymentProviders;
  provider_reference_id: string;
  payment_status: WebhookPaymentStatus;
  process: WebhookProcessStatus;
  event_created_at: number;
  amount_total: number;
  expires_at: number;
  currency: string;
  receipt_url: string;
  error_code: string;
  error_message: string;
  error_decline_code: string;
  updated_at: Date;
  created_at: Date;
}
