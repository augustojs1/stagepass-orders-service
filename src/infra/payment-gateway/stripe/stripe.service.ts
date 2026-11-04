import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { IPaymentGateway } from '@/infra/payment-gateway/interfaces/ipayment-gateway.interface';
import { CheckoutSessionData, OrderPaymentPayload } from './models';
import { PaymentProviders } from '@/modules/payment-orders/enum';
import { IPaymentMessageProducer } from '@/infra/messages/producers/payment/interfaces/message-producer.interface';
import { PaymentGatewayWebhookEventsRepository } from '../../payment-gateway/payment-gateway-webhook-events.repository';

@Injectable()
export class StripeService implements IPaymentGateway {
  private readonly logger = new Logger(StripeService.name);

  private readonly stripeClient: Stripe;
  private readonly appHost: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentMessageProducer: IPaymentMessageProducer,
    private readonly paymentGatewayWebhookEventsRepository: PaymentGatewayWebhookEventsRepository,
  ) {
    this.stripeClient = new Stripe(
      this.configService.getOrThrow<string>('stripe.secret_key'),
      {
        apiVersion: '2026-01-28.clover',
      },
    );

    this.appHost = this.configService.getOrThrow<string>('app_host');

    this.logger.log('Successfully initialized Stripe Client');
  }

  public async process(
    data: OrderPaymentPayload,
  ): Promise<CheckoutSessionData> {
    this.logger.log(`Creating Stripe checkout for order_id=${data.order_id}`);

    try {
      if (!data.idempotency_key) {
        throw new Error(
          `Stripe idempotency key is required for order_id=${data.order_id}`,
        );
      }

      if (!Number.isSafeInteger(data.amount) || data.amount <= 0) {
        throw new Error(`Invalid payment amount for order_id=${data.order_id}`);
      }

      const session = await this.stripeClient.checkout.sessions.create(
        {
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Order #${data.order_id}`,
                },
                unit_amount: data.amount,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${this.appHost}` + `?orderId=${data.order_id}`,
          cancel_url: `${this.appHost}` + `?orderId=${data.order_id}`,
          client_reference_id: data.order_id,
          metadata: {
            orderId: data.order_id,
          },
          payment_intent_data: {
            metadata: {
              orderId: data.order_id,
            },
          },
        },
        {
          idempotencyKey: data.idempotency_key,
        },
      );

      if (!session.url) {
        throw new Error(
          `Stripe returned checkout session without URL for order_id=${data.order_id}`,
        );
      }

      this.logger.log(
        `Successfully created Stripe checkout session_id=${session.id}, order_id=${data.order_id}`,
      );

      return {
        provider: PaymentProviders.STRIPE,
        provider_reference_id: session.id,
        checkout_url: session.url,
        checkout_url_expires_at: session.expires_at,
      };
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to create Stripe checkout for order_id=${data.order_id}`,
        err.stack,
      );

      throw error;
    }
  }

  async handleEvent(
    body: Buffer | string,
    sig: string | string[],
  ): Promise<void> {
    try {
      const signature = Array.isArray(sig) ? sig[0] : sig;

      if (!signature) {
        throw new Error('Stripe webhook signature is missing');
      }

      const event = this.stripeClient.webhooks.constructEvent(
        body,
        signature,
        this.configService.getOrThrow<string>('stripe.webhook_key'),
      );

      this.logger.log(
        `Received Stripe webhook event_id=${event.id}, type=${event.type}`,
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleSuccessEvent(event);
          break;

        case 'checkout.session.expired':
          await this.handleExpiredEvent(event);
          break;

        case 'payment_intent.payment_failed':
          await this.handleFailedEvent(event);
          break;

        default:
          this.logger.debug(
            `Ignoring unsupported Stripe event type=${event.type}`,
          );
          break;
      }

      this.logger.log(
        `Successfully handled Stripe webhook event_id=${event.id}, type=${event.type}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error('Failed to process Stripe webhook', err.stack);

      throw new InternalServerErrorException(
        'Failed to process Stripe webhook',
      );
    }
  }

  async handleSuccessEvent(
    event: Stripe.CheckoutSessionCompletedEvent,
  ): Promise<void> {
    const session = event.data.object;

    const orderId = session.metadata?.orderId;
    const paymentStatus = session.payment_status;

    if (!orderId) {
      throw new Error(`Missing orderId metadata for session_id=${session.id}`);
    }

    if (paymentStatus !== 'paid') {
      this.logger.warn(
        `Checkout completed without confirmed payment. ` +
          `order_id=${orderId}, ` +
          `session_id=${session.id}, ` +
          `payment_status=${paymentStatus}`,
      );

      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntentId) {
      throw new Error(`PaymentIntent not found for session_id=${session.id}`);
    }

    const charges = await this.stripeClient.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });

    const receiptUrl = charges.data[0]?.receipt_url ?? null;

    await this.paymentGatewayWebhookEventsRepository.insert({
      order_id: orderId,
      provider_reference_id: session.id,
      provider: 'STRIPE',
      process: 'PROCESSING',
      amount_total: session.amount_total,
      payment_status: 'PAID',
      currency: session.currency ?? 'usd',
      event_created_at: event.created,
      expires_at: session.expires_at,
      receipt_url: receiptUrl,
      error_code: null,
      error_decline_code: null,
      error_message: null,
    });

    this.logger.log(
      `Successfully saved PAID webhook event for ` +
        `order_id=${orderId}, ` +
        `provider_reference_id=${session.id}`,
    );

    await this.paymentMessageProducer.emitSuccess({
      order_id: orderId,
      provider_reference_id: session.id,
      receipt_url: receiptUrl,
    });

    this.logger.log(
      `Successfully published payment success message for ` +
        `order_id=${orderId}, ` +
        `provider_reference_id=${session.id}`,
    );
  }

  async handleFailedEvent(
    event: Stripe.PaymentIntentPaymentFailedEvent,
  ): Promise<void> {
    const paymentIntent = event.data.object;

    const orderId = paymentIntent.metadata?.orderId;
    const paymentError = paymentIntent.last_payment_error;

    this.logger.warn(
      `Stripe payment attempt failed. ` +
        `event_id=${event.id}, ` +
        `order_id=${orderId ?? 'unknown'}, ` +
        `payment_intent_id=${paymentIntent.id}, ` +
        `status=${paymentIntent.status}, ` +
        `error_code=${paymentError?.code ?? 'unknown'}, ` +
        `decline_code=${paymentError?.decline_code ?? 'unknown'}, ` +
        `error_message=${paymentError?.message ?? 'unknown'}`,
    );
  }

  async handleExpiredEvent(
    event: Stripe.CheckoutSessionExpiredEvent,
  ): Promise<void> {
    const session = event.data.object;

    const orderId = session.metadata?.orderId ?? session.client_reference_id;

    const providerReferenceId = session.id;

    try {
      if (!orderId) {
        throw new Error(
          `Missing orderId for expired checkout session_id=${providerReferenceId}`,
        );
      }

      if (session.status !== 'expired') {
        throw new Error(
          `Invalid checkout session status=${session.status} for session_id=${providerReferenceId}`,
        );
      }

      if (session.payment_status === 'paid') {
        this.logger.warn(
          `Ignoring expiration for paid checkout. ` +
            `order_id=${orderId}, ` +
            `session_id=${providerReferenceId}`,
        );

        return;
      }

      this.logger.log(
        `Processing expired checkout session. ` +
          `event_id=${event.id}, ` +
          `order_id=${orderId}, ` +
          `session_id=${providerReferenceId}`,
      );

      await this.paymentGatewayWebhookEventsRepository.insert({
        order_id: orderId,
        provider_reference_id: providerReferenceId,
        provider: 'STRIPE',
        process: 'PROCESSING',
        amount_total: session.amount_total,
        payment_status: 'FAILED',
        currency: session.currency ?? 'usd',
        event_created_at: event.created,
        expires_at: session.expires_at,
        receipt_url: null,
        error_code: 'checkout_session_expired',
        error_decline_code: null,
        error_message: 'Stripe Checkout Session expired',
      });

      this.logger.log(
        `Successfully saved expired checkout webhook. ` +
          `order_id=${orderId}, ` +
          `provider_reference_id=${providerReferenceId}`,
      );

      await this.paymentMessageProducer.emitFailed({
        order_id: orderId,
        provider_reference_id: providerReferenceId,
        error_code: 'checkout_session_expired',
        error_decline_code: null,
        error_message: 'Stripe Checkout Session expired',
      });

      this.logger.log(
        `Successfully published checkout expiration message. ` +
          `order_id=${orderId}, ` +
          `provider_reference_id=${providerReferenceId}`,
      );
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to handle expired checkout session. ` +
          `event_id=${event.id}, ` +
          `order_id=${orderId ?? 'unknown'}, ` +
          `session_id=${providerReferenceId}`,
        err.stack,
      );

      throw error;
    }
  }

  async expireCheckoutSession(
    sessionId: string,
  ): Promise<'EXPIRED' | 'PAID' | 'UNRESOLVED'> {
    try {
      const session =
        await this.stripeClient.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid') {
        this.logger.warn(
          `Checkout session=${sessionId} already has a confirmed payment`,
        );

        return 'PAID';
      }

      if (session.status === 'expired') {
        this.logger.log(`Checkout session=${sessionId} is already expired`);

        return 'EXPIRED';
      }

      if (session.status === 'complete') {
        this.logger.warn(
          `Checkout session=${sessionId} is completed but payment_status=${session.payment_status}`,
        );

        return 'UNRESOLVED';
      }

      if (session.status !== 'open') {
        this.logger.warn(
          `Unexpected Stripe checkout status=${session.status} for session=${sessionId}`,
        );

        return 'UNRESOLVED';
      }

      try {
        const expiredSession =
          await this.stripeClient.checkout.sessions.expire(sessionId);

        if (expiredSession.status !== 'expired') {
          throw new Error(
            `Stripe did not confirm expiration for session=${sessionId}`,
          );
        }

        this.logger.log(`Successfully expired checkout session=${sessionId}`);

        return 'EXPIRED';
      } catch (error) {
        const currentSession =
          await this.stripeClient.checkout.sessions.retrieve(sessionId);

        if (currentSession.payment_status === 'paid') {
          return 'PAID';
        }

        if (currentSession.status === 'expired') {
          return 'EXPIRED';
        }

        if (currentSession.status === 'complete') {
          return 'UNRESOLVED';
        }

        throw error;
      }
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        `Failed to expire Stripe checkout session=${sessionId}`,
        err.stack,
      );

      throw error;
    }
  }
}
