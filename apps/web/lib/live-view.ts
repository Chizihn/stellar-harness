import { formatDecimal } from './format';
import { LAG_DELAYED_SECONDS } from './live-schemas';

export const secondsSince = (iso: string, now: number): number =>
  Math.max(0, Math.round((now - Date.parse(iso)) / 1000));

export const isDelayed = (endCloseTime: string | null, now: number): boolean =>
  endCloseTime === null || secondsSince(endCloseTime, now) > LAG_DELAYED_SECONDS;

export const formatAge = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
};

export const formatUtc = (iso: string): string => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

export const formatCount = (value: number): string => formatDecimal(value, 0);

export const formatShare = (share: number): string =>
  share > 0 && share < 0.001 ? '<0.1%' : `${formatDecimal(share * 100, 1)}%`;

export const formatXlm = (value: number): string =>
  formatDecimal(value, value >= 100 ? 0 : value >= 1 ? 2 : 4);

export const formatUsd = (value: number): string => formatDecimal(value, value >= 100 ? 0 : 2);

export const yesterdayUtc = (now: number): string =>
  new Date(now - 86_400_000).toISOString().slice(0, 10);
