export const WEBHOOK_PROCESS_STATUSES = [
  'PROCESSED',
  'PROCESSING',
  'FAILED_TO_PROCESS',
] as const;

export type WebhookProcessStatus = (typeof WEBHOOK_PROCESS_STATUSES)[number];
