import { PaymentProviders } from '@/modules/payment-orders/enum';

export class CheckoutSessionData {
  provider: PaymentProviders;
  provider_reference_id: string;
  checkout_url: string;
  checkout_url_expires_at: number;
}
