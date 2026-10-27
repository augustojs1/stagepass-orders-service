import { Module } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { DrizzlePostgresModule } from '@knaadh/nestjs-drizzle-postgres';

import * as schema from './schemas';
import { configuration } from '@/infra/config/configuration';

dotenv.config({
  path: `${process.cwd()}/src/infra/config/env/${process.env.NODE_ENV}.env`,
});

export const DATABASE_TAG = 'STAGEPASS_DB';

@Module({
  imports: [
    DrizzlePostgresModule.register({
      tag: DATABASE_TAG,
      postgres: {
        url: configuration().database.url,
        config: {
          host: configuration().database.host,
          port: Number(configuration().database.port),
          user: configuration().database.user,
          password: configuration().database.password,
          database: configuration().database.database,
        },
      },
      config: { schema: { ...schema } },
    }),
  ],
})
export class DrizzleModule {}
