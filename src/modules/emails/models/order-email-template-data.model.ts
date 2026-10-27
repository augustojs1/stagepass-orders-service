export class OrderEmailTemplateData {
  customer_name: string;
  order_id: string;
  tickets_count: number;
  order_total: string | number;
  event_name: string;
  event_date: Date | string;
  event_location: string;
  receipt_url: string | null;
  checkout_url: string | null;
  payment_status: string;
  error_message: string | null;
  current_year: number;
}
