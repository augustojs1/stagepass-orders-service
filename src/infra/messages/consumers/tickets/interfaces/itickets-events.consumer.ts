export abstract class ITicketsEventsConsumer {
  abstract handle(payload: any, ctx: any): Promise<void>;
}
