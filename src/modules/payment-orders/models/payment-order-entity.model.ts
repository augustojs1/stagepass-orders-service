import { PaymentOrderStatus } from '../enum';

export const PAYMENT_PROVIDERS = ['STRIPE'] as const;

export type PaymentProviders = (typeof PAYMENT_PROVIDERS)[number];

export class PaymentOrderEntity {
  id: string;
  order_id: string;
  provider: PaymentProviders;
  provider_reference_id: string;
  status: PaymentOrderStatus;
  checkout_url: string;
  checkout_url_expires_at: Date;
  amount: number;
  currency: string;
  receipt_url: string;
  error_code: string;
  error_message: string;
  updated_at: Date;
  created_at: Date;
}
