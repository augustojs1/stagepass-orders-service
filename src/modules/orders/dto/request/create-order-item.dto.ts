import { z } from 'zod';

export const createrOrderItemDtoSchema = z
  .object({
    event_ticket_id: z.uuidv4().min(1),
    owner_name: z.string().min(1),
    owner_email: z.string().min(1),
  })
  .required();

export type CreateOrderItemDto = z.infer<typeof createrOrderItemDtoSchema>;
