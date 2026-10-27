import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, z } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      if (value === undefined) {
        return value;
      }

      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      const parsedZodError = z.treeifyError(error);

      throw new BadRequestException({
        message: 'Validation error',
        error: 'Bad Request',
        statusCode: 400,
        errors: parsedZodError,
      });
    }
  }
}
