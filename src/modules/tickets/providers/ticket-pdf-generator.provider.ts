import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

import { TicketData } from '../models';

@Injectable()
export class TicketPdfGeneratorProvider {
  async generate(ticketData: TicketData): Promise<Buffer<ArrayBufferLike>> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    const qrBuffer = await QRCode.toBuffer(
      `https://stagepass.com/verify/${ticketData.code}`,
    );

    const formattedDate = this.formatEventDate(ticketData.starts_at);

    const address = this.formatAddress(ticketData);

    doc.fontSize(24).text(ticketData.event_name, { align: 'center' });

    doc.moveDown(2);

    const startY = doc.y;

    const leftColumnX = 50;
    const rightColumnX = 300;

    doc
      .fontSize(12)
      .text(`Date`, leftColumnX, startY)
      .fontSize(14)
      .text(formattedDate, leftColumnX);

    doc.moveDown();

    doc
      .fontSize(12)
      .text(`Location`, leftColumnX)
      .fontSize(14)
      .text(address, leftColumnX, doc.y, { width: 200 });

    doc
      .fontSize(12)
      .text(`Attendee`, rightColumnX, startY)
      .fontSize(14)
      .text(ticketData.owner_name, rightColumnX);

    doc.moveDown();

    doc
      .fontSize(12)
      .text(`Email`, rightColumnX)
      .fontSize(14)
      .text(ticketData.owner_email, rightColumnX);

    doc.moveDown();

    doc
      .fontSize(12)
      .text(`Price`, rightColumnX)
      .fontSize(14)
      .text(`$ ${(ticketData.unit_price / 100).toFixed(2)}`, rightColumnX);

    doc.moveDown(4);

    const pageWidth = doc.page.width;
    const qrSize = 200;

    const qrX = (pageWidth - qrSize) / 2;

    doc.image(qrBuffer, qrX, doc.y, {
      width: qrSize,
    });

    doc.moveDown(0.3);

    doc.fontSize(10).text('Present this QR Code at the event entrance', {
      align: 'center',
    });

    doc.end();

    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }

  saveOnDisk(buffer: Buffer<ArrayBufferLike>, bufferName: string): void {
    const filePath = path.join(process.cwd(), `ticket_${bufferName}.pdf`);

    fs.writeFileSync(filePath, buffer);
  }

  private formatEventDate(date: Date): string {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    const day = date.getUTCDate().toString().padStart(2, '0');

    const month = date.toLocaleString('en-US', { month: 'long' });

    const year = date.getUTCFullYear();

    return `${hours}h${minutes} - ${day} of ${month}, ${year}`;
  }

  private formatAddress(event: any): string {
    return `${event.address_street}, ${event.address_number} - ${event.address_district}, ${event.address_city}`;
  }
}
