import { Injectable } from '@nestjs/common';
import { compareAsc, differenceInHours } from 'date-fns';

@Injectable()
export class DateProvider {
  isAfter(first_date: Date, second_date: Date): boolean {
    return compareAsc(first_date, second_date) === -1;
  }

  differenceInHours(first_date: Date, second_date: Date): number {
    return differenceInHours(first_date, second_date);
  }

  isExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
    const expiresAtDate = new Date(expiresAt);

    return expiresAtDate.getTime() <= now.getTime();
  }

  unixToDate(unixTimestamp: number): Date {
    return new Date(unixTimestamp * 1000);
  }

  dateToISOString(date: Date): string {
    return date.toISOString();
  }
}
