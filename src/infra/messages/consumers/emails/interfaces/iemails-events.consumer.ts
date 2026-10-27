export abstract class IEmailsEventsConsumer {
  abstract handle(payload: any, ctx: any): Promise<void>;
}
