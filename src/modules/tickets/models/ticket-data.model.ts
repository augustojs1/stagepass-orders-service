export class TicketData {
  event_name: string;
  owner_id: string;
  order_id: string;
  event_ticket_id: string;
  starts_at: Date;
  address_number: string;
  address_district: string;
  address_street: string;
  address_city: string;
  owner_name: string;
  owner_email: string;
  unit_price: number;
  code?: string;
  order_owner_email: string;
  order_item_id: string;
}
