export const WEBHOOK_PAYMENT_STATUS = ['PAID', 'FAILED'] as const;

export type WebhookPaymentStatus = (typeof WEBHOOK_PAYMENT_STATUS)[number];
