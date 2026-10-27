export class EventsEntity {
  id: string;
  organizer_id: string;
  event_category_id: string;
  name: string;
  description: string;
  slug: string;
  banner_url: string;
  is_free: boolean;
  address_street: string;
  address_number: string;
  address_district: string;
  address_city: string;
  country_id: string;
  location: {
    x: number;
    y: number;
  };
  sales_starts_at: Date;
  starts_at: Date;
  ends_at: Date;
  updated_at: Date;
  created_at: Date;
}
