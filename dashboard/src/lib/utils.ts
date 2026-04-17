import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return '—';
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const delta = Date.now() - ms;
  const s = Math.round(delta / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ms).toLocaleString();
}

export function formatDuration(startedAt?: number, finishedAt?: number): string {
  if (!startedAt) return '—';
  const endMs = finishedAt
    ? finishedAt > 1e12
      ? finishedAt
      : finishedAt * 1000
    : Date.now();
  const startMs = startedAt > 1e12 ? startedAt : startedAt * 1000;
  const s = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}
