import { z } from 'zod';

const payment_provider = ['STRIPE'];

export const payOrderDtoSchema = z
  .object({
    payment_provider: z.enum(payment_provider),
  })
  .required();

export type PayOrderDto = z.infer<typeof payOrderDtoSchema>;
