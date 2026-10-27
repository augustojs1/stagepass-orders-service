import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';

import { StripeService } from './stripe.service';

@Controller('webhooks')
export class StripeController {
  constructor(private readonly StripeService: StripeService) {}

  @Post('payment/stripe')
  @HttpCode(200)
  async handleStripe(@Req() req: Request) {
    const sig = req.headers['stripe-signature'];

    await this.StripeService.handleEvent(req.body, sig);
  }
}
