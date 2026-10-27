import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schema from '@/infra/database/orm/drizzle/schemas';
import { DATABASE_TAG } from '@/infra/database/orm/drizzle/drizzle.module';
import { EmailTemplateType } from './enums/email-template-type.enum';

@Injectable()
export class EmailTemplatesRepository {
  constructor(
    @Inject(DATABASE_TAG)
    private readonly drizzle: PostgresJsDatabase<typeof schema>,
  ) {}

  async findByType(type: EmailTemplateType) {
    const result = await this.drizzle
      .select()
      .from(schema.email_templates)
      .where(eq(schema.email_templates.type, type));

    return result[0] ?? null;
  }
}
