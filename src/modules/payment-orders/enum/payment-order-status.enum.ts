export const PAYMENT_ORDER_STATUSES = [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;

export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];
