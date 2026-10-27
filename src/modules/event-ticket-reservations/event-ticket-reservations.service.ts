import { Injectable } from '@nestjs/common';

@Injectable()
export class EventTicketReservationsService {
  findAll() {
    return `This action returns all eventTicketReservations`;
  }

  findOne(id: number) {
    return `This action returns a #${id} eventTicketReservation`;
  }

  remove(id: number) {
    return `This action removes a #${id} eventTicketReservation`;
  }
}
