import * as Handlebars from 'handlebars';
import { Injectable } from '@nestjs/common';

import { OrderEmailTemplateData } from '../models';

@Injectable()
export class EmailTemplateRendererProvider {
  render(template: string, data: OrderEmailTemplateData): string {
    const compiledTemplate = Handlebars.compile(template);

    return compiledTemplate(data);
  }
}
