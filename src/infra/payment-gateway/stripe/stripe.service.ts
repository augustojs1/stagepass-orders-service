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
  private readonly logger: Logger = new Logger(StripeService.name);

  private readonly stripeClient: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentMessageProducer: IPaymentMessageProducer,
    private readonly paymentGatewayWebhookEventsRepository: PaymentGatewayWebhookEventsRepository,
  ) {
    this.stripeClient = new Stripe(
      this.configService.get<string>('stripe.secret_key'),
      {
        apiVersion: '2026-01-28.clover',
      },
    );

    this.logger.log('Succesfully init Stripe Client');
  }

  public async process(
    data: OrderPaymentPayload,
  ): Promise<CheckoutSessionData> {
    this.logger.log('Stripe received payment to process', data);

    try {
      const session = await this.stripeClient.checkout.sessions.create({
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
        success_url: `https://stagepass.augustojsdev.com.br/payment/success?orderId=${data.order_id}`,
        cancel_url: `https://stagepass.augustojsdev.com.br/payment/failed?orderId=${data.order_id}`,
        metadata: {
          orderId: data.order_id,
        },
        payment_intent_data: {
          metadata: { orderId: data.order_id },
        },
      });

      this.logger.log('Stripe successfully processed payment', data);

      return {
        provider: PaymentProviders.STRIPE,
        provider_reference_id: session.id,
        checkout_url: session.url,
        checkout_url_expires_at: session.expires_at,
      };
    } catch (error) {
      this.logger.error('Stripe error processing a payment', data);
      throw error;
    }
  }

  async handleEvent(body: any, sig: string | string[]): Promise<void> {
    try {
      const event = this.stripeClient.webhooks.constructEvent(
        body,
        sig,
        this.configService.get<string>('stripe.webhook_key'),
      );

      if (event.type === 'checkout.session.completed') {
        await this.handleSuccessEvent(event);
      }

      if (event.type === 'payment_intent.payment_failed') {
        await this.handleFailedEvent(event);
      }
    } catch (error) {
      const e = error as Error;

      this.logger.error(`Failed to process Stripe webhook!`, e?.stack);

      throw new InternalServerErrorException(
        'Failed to process Stripe webhook!',
      );
    }
  }

  async handleSuccessEvent(
    event: Stripe.CheckoutSessionCompletedEvent,
  ): Promise<void> {
    const session = event.data.object;

    const orderId = session.metadata?.orderId;
    const status = session.payment_status;

    if (status === 'paid') {
      const charges = await this.stripeClient.charges.list({
        payment_intent: String(session.payment_intent),
      });

      await this.paymentGatewayWebhookEventsRepository.insert({
        order_id: orderId,
        provider_reference_id: session.id,
        provider: 'STRIPE',
        process: 'PROCESSING',
        amount_total: session.amount_total,
        payment_status: 'PAID',
        currency: session.currency,
        event_created_at: session.created,
        expires_at: session.expires_at,
        receipt_url: charges.data[0].receipt_url,
        error_code: null,
        error_decline_code: null,
        error_message: null,
      });

      this.logger.log(
        `Successfully saved PAID payment_gateway_webhook_event for order_id=${orderId}, provider_reference_id=${session.id}`,
      );

      this.paymentMessageProducer.emitSuccess({
        order_id: orderId,
        provider_reference_id: session.id,
        receipt_url: charges.data[0].receipt_url,
      });
    }
  }

  async handleFailedEvent(
    event: Stripe.PaymentIntentPaymentFailedEvent,
  ): Promise<void> {
    const session = event.data.object;
    const intent = await this.stripeClient.paymentIntents.retrieve(session.id);

    const orderId = session['metadata']?.orderId;

    await this.paymentGatewayWebhookEventsRepository.insert({
      order_id: orderId,
      provider_reference_id: intent.payment_details.order_reference,
      provider: 'STRIPE',
      process: 'PROCESSING',
      amount_total: session.amount,
      payment_status: 'FAILED',
      currency: session.currency,
      event_created_at: session.created,
      expires_at: null,
      receipt_url: null,
      error_code: intent.last_payment_error.code,
      error_decline_code: intent.last_payment_error.decline_code,
      error_message: intent.last_payment_error.message,
    });

    this.logger.log(
      `Successfully saved FAILED payment_gateway_webhook_event for order_id=${orderId}, provider_reference_id=${session.id}`,
    );

    this.paymentMessageProducer.emitFailed({
      order_id: orderId,
      provider_reference_id: intent.payment_details.order_reference,
      error_code: intent.last_payment_error.code,
      error_decline_code: intent.last_payment_error.decline_code,
      error_message: intent.last_payment_error.message,
    });
  }
}
