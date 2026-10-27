import * as amqp from 'amqplib';

import {
  MessageExchanges,
  MessageQueues,
} from '@/infra/messages/consumers/enums';

type QueueItem = {
  main: string;
  retry: string;
  dlq: string;
  retry_delay_in_ms: number;
};

const QUEUES: QueueItem[] = [
  {
    main: MessageQueues.PAYMENT_SUCESS,
    retry: `${MessageQueues.PAYMENT_SUCESS}.retry`,
    dlq: `${MessageQueues.PAYMENT_SUCESS}.dlq`,
    retry_delay_in_ms: 30_000,
  },
  {
    main: MessageQueues.PAYMENT_FAILED,
    retry: `${MessageQueues.PAYMENT_FAILED}.retry`,
    dlq: `${MessageQueues.PAYMENT_FAILED}.dlq`,
    retry_delay_in_ms: 30_000,
  },
  {
    main: MessageQueues.TICKET_GENERATE,
    retry: `${MessageQueues.TICKET_GENERATE}.retry`,
    dlq: `${MessageQueues.TICKET_GENERATE}.dlq`,
    retry_delay_in_ms: 30_000,
  },
  {
    main: MessageQueues.EMAIL,
    retry: `${MessageQueues.EMAIL}.retry`,
    dlq: `${MessageQueues.EMAIL}.dlq`,
    retry_delay_in_ms: 30_000,
  },
];

export async function initRabbitMqMessageBroker(url: string): Promise<void> {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange(MessageExchanges.MAIN, 'direct', {
    durable: true,
  });

  await channel.assertExchange(MessageExchanges.DLX, 'direct', {
    durable: true,
  });

  for (const queue of QUEUES) {
    await channel.assertQueue(queue.main, {
      durable: true,
    });

    await channel.assertQueue(queue.retry, {
      durable: true,
      arguments: {
        'x-message-ttl': queue.retry_delay_in_ms,
        'x-dead-letter-exchange': MessageExchanges.MAIN,
        'x-dead-letter-routing-key': queue.main,
      },
    });

    await channel.assertQueue(queue.dlq, {
      durable: true,
    });

    await channel.bindQueue(queue.main, MessageExchanges.MAIN, queue.main);

    await channel.bindQueue(queue.retry, MessageExchanges.DLX, queue.retry);

    await channel.bindQueue(queue.dlq, MessageExchanges.DLX, queue.dlq);
  }

  await channel.close();
  await connection.close();
}
