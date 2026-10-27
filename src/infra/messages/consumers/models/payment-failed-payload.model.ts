export class PaymentFailedPayload {
  order_id: string;
  provider_reference_id: string;
  error_code: string;
  error_decline_code: string;
  error_message: string;
}
