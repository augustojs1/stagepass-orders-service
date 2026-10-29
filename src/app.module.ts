import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { configuration } from '@/infra/config/configuration';
import { DrizzleModule } from '@/infra/database/orm/drizzle/drizzle.module';
import { HttpRequestInterceptor } from '@/infra/interceptors';
import { EventTicketReservationsModule } from './modules/event-ticket-reservations/event-ticket-reservations.module';
import { SchedulerModule } from './infra/jobs/scheduler.module';
import { MessagesModule } from './infra/messages/messages.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { EmailsModule } from './modules/emails/emails.module';
import { SMTPModule } from './infra/smtp/smtp.module';
import { PaymentOrdersModule } from './modules/payment-orders/payment-orders.module';
import { EventsModule } from './modules/events/events.module';
import { PaymentGatewayModule } from './infra/payment-gateway/payment-gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.cwd()}/src/infra/config/env/${process.env.NODE_ENV}.env`,
      isGlobal: true,
      load: [configuration],
    }),
    DrizzleModule,
    EventTicketReservationsModule,
    EventTicketReservationsModule,
    TicketsModule,
    SchedulerModule,
    MessagesModule,
    EmailsModule,
    SMTPModule,
    PaymentOrdersModule,
    EventsModule,
    PaymentGatewayModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpRequestInterceptor,
    },
  ],
})
export class AppModule {}
