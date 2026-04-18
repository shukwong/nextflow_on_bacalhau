import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Bacalhau returns timestamps as nanoseconds since epoch (~1.7e18).
 * Accept seconds, ms, or ns transparently and normalize to ms.
 */
export function toMilliseconds(timestamp: number): number {
  if (timestamp >= 1e15) return Math.floor(timestamp / 1e6); // ns → ms
  if (timestamp >= 1e12) return timestamp; // already ms
  return timestamp * 1000; // seconds → ms
}

export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return '—';
  const ms = toMilliseconds(timestamp);
  const delta = Date.now() - ms;
  const s = Math.round(delta / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ms).toLocaleString();
}

export function formatTimeOfDay(timestamp?: number): string {
  if (!timestamp) return '—';
  const ms = toMilliseconds(timestamp);
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${mon}-${dd} ${hh}:${mm}`;
}

export function durationSeconds(startedAt?: number, finishedAt?: number): number {
  if (!startedAt) return 0;
  const endMs = finishedAt ? toMilliseconds(finishedAt) : Date.now();
  const startMs = toMilliseconds(startedAt);
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

export function formatDuration(startedAt?: number, finishedAt?: number): string {
  if (!startedAt) return '—';
  const endMs = finishedAt ? toMilliseconds(finishedAt) : Date.now();
  const startMs = toMilliseconds(startedAt);
  const s = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}
