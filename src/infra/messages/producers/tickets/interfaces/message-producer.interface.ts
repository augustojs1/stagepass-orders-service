export abstract class ITicketsMessageProducer {
  abstract emit(order_id: string): void;
}
