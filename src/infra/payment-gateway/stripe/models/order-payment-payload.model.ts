export class OrderPaymentPayload {
  order_id: string;
  amount: number;
  idempotency_key: string;
}
