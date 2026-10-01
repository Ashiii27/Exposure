/**
 * Exposure — the ScanResult contract (plan §4).
 *
 * This is the single JSON shape produced by BOTH scan paths
 * (nightly GitHub Actions scanner, live Cloudflare Worker) and consumed by
 * the web frontend and the leaderboard. It is zod-validated everywhere.
 *
 * Privacy rules baked in:
 *  - cookie/storage VALUES are never stored, only names, attributes, lengths;
 *  - request URLs pass through `redactUrl` before storage;
 *  - the schema is versioned — see SCHEMA_VERSION in constants.ts.
 */

import { z } from 'zod';
import {
  DOMAIN_CATEGORIES,
  RESOURCE_TYPES,
  SCHEMA_VERSION,
  SENSITIVE_QUERY_PARAM_PATTERN
} from './constants.js';

const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
export const IsoUtcString = z.string().regex(isoUtc, 'must be an ISO-8601 UTC timestamp');

export const TrackerListSource = z.enum(['disconnect', 'ddg', 'easyprivacy', 'cdn-allowlist']);
export type TrackerListSource = z.infer<typeof TrackerListSource>;

export const ScanSource = z.enum(['nightly', 'live']);
export type ScanSource = z.infer<typeof ScanSource>;

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

export const RedirectEntrySchema = z.object({
  url: z.string().min(1),
  status: z.number().int().min(100).max(599),
  location: z.string().optional(),
  atMs: z.number().int().nonnegative()
});
export type RedirectEntry = z.infer<typeof RedirectEntrySchema>;

export const RecordedRequestSchema = z.object({
  id: z.number().int().nonnegative(),
  url: z.string().min(1),
  domain: z.string().min(1),
  isThirdParty: z.boolean(),
  resourceType: z.enum(RESOURCE_TYPES),
  method: z.string().min(1).default('GET'),
  status: z.number().int().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative().nullable(),
  initiatorDomain: z.string().nullable()
});
export type RecordedRequest = z.infer<typeof RecordedRequestSchema>;

export const RecordedCookieSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  valueLength: z.number().int().nonnegative(),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).nullable(),
  /** null for session cookies. */
  expiresAt: IsoUtcString.nullable(),
  /** null for session cookies; otherwise days from scan time. */
  lifetimeDays: z.number().nonnegative().nullable(),
  isThirdParty: z.boolean()
});
export type RecordedCookie = z.infer<typeof RecordedCookieSchema>;

export const StorageType = z.enum(['localStorage', 'sessionStorage', 'indexedDB']);
export type StorageType = z.infer<typeof StorageType>;

export const RecordedStorageSchema = z.object({
  type: StorageType,
  domain: z.string().min(1),
  key: z.string(),
  valueLength: z.number().int().nonnegative()
});
export type RecordedStorage = z.infer<typeof RecordedStorageSchema>;

export const FingerprintEventSchema = z.object({
  api: z.string().min(1),
  family: z.enum(['canvas', 'webgl', 'audio', 'fonts', 'other']),
  domain: z.string().min(1),
  scriptUrl: z.string().nullable(),
  count: z.number().int().positive(),
  firstSeenMs: z.number().int().nonnegative()
});
export type FingerprintEvent = z.infer<typeof FingerprintEventSchema>;

export const DomainClassificationSchema = z.object({
  domain: z.string().min(1),
  requestCount: z.number().int().nonnegative(),
  categories: z.array(z.enum(DOMAIN_CATEGORIES)).min(1),
  company: z.string().nullable(),
  isFirstParty: z.boolean(),
  sources: z.array(TrackerListSource)
});
export type DomainClassification = z.infer<typeof DomainClassificationSchema>;

export const ScoreComponentSchema = z.object({
  rule: z.string().min(1),
  points: z.number().int().nonnegative(),
  detail: z.string().min(1)
});
export type ScoreComponent = z.infer<typeof ScoreComponentSchema>;

export const ScoreSchema = z.object({
  value: z.number().int().min(0).max(100),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  components: z.array(ScoreComponentSchema),
  explanation: z.string().min(1)
});
export type Score = z.infer<typeof ScoreSchema>;

export const SummarySchema = z.object({
  totalRequests: z.number().int().nonnegative(),
  thirdPartyRequests: z.number().int().nonnegative(),
  distinctDomains: z.number().int().nonnegative(),
  distinctTrackerDomains: z.number().int().nonnegative(),
  companiesLearned: z.number().int().nonnegative(),
  cookieCount: z.number().int().nonnegative(),
  longLivedCookieCount: z.number().int().nonnegative(),
  fingerprintApiFamilies: z.array(z.enum(['canvas', 'webgl', 'audio', 'fonts'])),
  companies: z.array(z.string())
});
export type Summary = z.infer<typeof SummarySchema>;

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

export const ScanResultSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  scannerVersion: z.string().min(1),
  source: ScanSource,
  requestedUrl: z.string().min(1),
  finalUrl: z.string().min(1),
  timestamp: IsoUtcString,
  scanDurationMs: z.number().int().positive(),
  redirects: z.array(RedirectEntrySchema),
  requests: z.array(RecordedRequestSchema),
  cookies: z.array(RecordedCookieSchema),
  storage: z.array(RecordedStorageSchema),
  fingerprinting: z.array(FingerprintEventSchema),
  domains: z.array(DomainClassificationSchema),
  score: ScoreSchema,
  summary: SummarySchema
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip obviously sensitive query parameters from a URL before it is stored
 * or displayed. Returns the original string if it does not parse.
 */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const params = [...url.searchParams.keys()];
    let removed = false;
    for (const param of params) {
      if (SENSITIVE_QUERY_PARAM_PATTERN.test(param)) {
        url.searchParams.set(param, '[redacted]');
        removed = true;
      }
    }
    return removed ? url.toString() : raw;
  } catch {
    return raw;
  }
}

/** True when the string parses as an ISO-8601 UTC timestamp. */
export function isIsoUtc(value: string): boolean {
  return isoUtc.test(value);
}
