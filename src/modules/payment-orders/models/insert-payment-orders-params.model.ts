import { PaymentOrderStatus, PaymentProviders } from '../enum';

export class InsertPaymentOrdersParams {
  order_id: string;
  provider: PaymentProviders;
  provider_reference_id?: string;
  status: PaymentOrderStatus;
  checkout_url?: string;
  checkout_url_expires_at?: Date;
  amount: number;
  currency: string;
  receipt_url?: string;
  error_code?: string;
  error_message?: string;
}
