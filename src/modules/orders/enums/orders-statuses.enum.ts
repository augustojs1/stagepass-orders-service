export const ORDER_STATUSES = [
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
] as const;

export type OrderStatuses = (typeof ORDER_STATUSES)[number];
