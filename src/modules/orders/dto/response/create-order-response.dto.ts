import { OrderStatuses } from '../../enums';

export class CreateOrderResponseDto {
  id: string;
  user_id: string;
  event_id: string;
  status: OrderStatuses;
  total_price: number;
  reservation_expires_at: Date | null;
  updated_at: Date;
  created_at: Date;
}
