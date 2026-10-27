import { Injectable } from '@nestjs/common';
import { compareAsc, differenceInHours, format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

@Injectable()
export class DateProvider {
  isAfter(first_date: Date, second_date: Date): boolean {
    const result = compareAsc(first_date, second_date);

    if (result === -1) {
      return true;
    }

    return false;
  }

  differenceInHours(first_date: Date, second_date: Date): number {
    const result = differenceInHours(first_date, second_date);

    return result;
  }

  isExpired(expiresAt: string, now: Date = new Date()): boolean {
    const expiresAtDate = new Date(expiresAt);

    return expiresAtDate.getTime() <= now.getTime();
  }

  unixToTimestampTz(unixTimestamp: number, timezone: string): string {
    const date = new Date(unixTimestamp * 1000);

    const zonedDate = toZonedTime(date, timezone);

    return format(zonedDate, 'yyyy-MM-dd HH:mm:ss.SSS xxx');
  }

  dateToTimestampTz(date: Date, timezone: string): string {
    return formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm:ss.SSS xxx');
  }
}
