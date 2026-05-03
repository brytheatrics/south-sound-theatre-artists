// Type declarations for scripts/_lib/calendar-sync.mjs.
// Lets the SvelteKit server-side admin page import the lib without
// svelte-check complaining about implicit `any` from the JS file.
//
// Keep in sync with the actual lib exports.

import type { Client } from "pg";

export interface SyncResult {
  status: "ok" | "unchanged" | "empty" | "error";
  showCount?: number;
  performanceCount?: number;
  cost?: number;
  error?: string;
  durationMs: number;
  htmlChanged?: boolean;
  showErrors?: string[];
}

export interface EventSourceRow {
  id: string;
  org_slug: string;
  org_name: string;
  source_url: string;
  adapter: string;
  last_hash: string | null;
  last_show_count: number | null;
  cadence_days: number;
  last_checked_at: string | null;
  last_status: string;
  cooldown_until?: string | null;
}

export interface SyncOpts {
  force?: boolean;
  today?: string;
}

export function syncEventSource(
  db: Client,
  source: EventSourceRow,
  opts?: SyncOpts,
): Promise<SyncResult>;

export function fetchHtml(url: string): Promise<string>;
export function cleanHtml(html: string): string;
export function hashContent(s: string): string;
export function callClaude(
  prompt: string,
  opts?: { isRetry?: boolean },
): Promise<{ text: string; usage: Record<string, number> }>;
export function expandPerformances(show: {
  run_start?: string | null;
  run_end?: string | null;
  schedule?: Array<{ weekdays: string[]; time: string }>;
  special?: Array<{ date: string; time: string; note: string }>;
  explicit_performances?: Array<{ date: string; time: string }>;
}): {
  performances: Array<{ datetime: string; note: string | null }>;
  flags: string[];
};
