export class TicketEntity {
  id: string;
  order_item_id: string;
  owner_id: string;
  event_ticket_id: string;
  file_url: string;
  checked_in: boolean;
  checked_in_at: Date;
  code: string;
  updated_at: Date;
  created_at: Date;
}
