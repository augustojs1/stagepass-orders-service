import { z } from 'zod';

export const createrOrderDtoSchema = z
  .object({
    event_id: z.uuidv4().min(1),
  })
  .required();

export type CreateOrderDto = z.infer<typeof createrOrderDtoSchema>;
