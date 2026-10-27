import {
  PaymentOrderStatus,
  PaymentProviders,
} from '@/modules/payment-orders/enum';

export class PayOrderCheckoutResponseDto {
  provider: PaymentProviders;
  checkout_url: string;
  checkout_url_expires_at: string;
  status: PaymentOrderStatus;
  receipt_url: string | null;
}
