export class EventTicketsEntity {
  id: string;
  event_id: string;
  name: string;
  price: number;
  amount: number;
  sold: boolean;
  updated_at: Date;
  created_at: Date;
}
