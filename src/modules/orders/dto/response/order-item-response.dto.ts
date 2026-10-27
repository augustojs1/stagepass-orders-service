export class OrderItemResponseDto {
  id: string;
  order_id: string;
  event_ticket_id: string;
  owner_name: string;
  owner_email: string;
  unit_price: number;
  updated_at: Date;
  created_at: Date;
}
