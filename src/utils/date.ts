import { APP_CONFIG } from '@/config/app.config';
import type { ISODateString } from '@/types/common';

export function nowISO(): ISODateString {
  return new Date().toISOString();
}

export function formatDate(value: ISODateString | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(APP_CONFIG.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value: ISODateString | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(APP_CONFIG.locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateTime(value: ISODateString | Date): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}
