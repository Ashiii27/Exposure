/**
 * Exposure — shared constants.
 *
 * Everything that scanner, worker and web must agree on lives here:
 * the result-schema version, the domain-category taxonomy and its colours,
 * the score weights, and the free-tier budgets we design around.
 */

/** Bump when the ScanResult JSON shape changes in a breaking way. */
export const SCHEMA_VERSION = 1;

/** Fixed domain-category taxonomy (plan §5.2). Worst category wins for colouring. */
export const DOMAIN_CATEGORIES = [
  'first-party',
  'advertising',
  'analytics',
  'social',
  'fingerprinting',
  'cdn',
  'uncategorized'
] as const;

export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

/** Categories that count as "trackers" for scoring and the headline stat. */
export const TRACKER_CATEGORIES: readonly DomainCategory[] = [
  'advertising',
  'analytics',
  'social',
  'fingerprinting'
];

/** The categories that count as "companies that learned you visited". */
export const COMPANY_COUNTED_CATEGORIES: readonly DomainCategory[] = [
  'advertising',
  'analytics',
  'social',
  'fingerprinting'
];

/** Node colours on dark theme, one per category. */
export const CATEGORY_COLORS: Record<DomainCategory, string> = {
  'first-party': '#4ade80',
  advertising: '#f87171',
  analytics: '#fbbf24',
  social: '#a78bfa',
  fingerprinting: '#f472b6',
  cdn: '#38bdf8',
  uncategorized: '#94a3b8'
};

/**
 * Disconnect's category names → our taxonomy.
 * Disconnect carries 11 categories (verified 2026-10-01); anything unmapped
 * is treated as `uncategorized`.
 */
export const DISCONNECT_CATEGORY_MAP: Record<string, DomainCategory> = {
  Advertising: 'advertising',
  Analytics: 'analytics',
  Social: 'social',
  FingerprintingInvasive: 'fingerprinting',
  FingerprintingGeneral: 'fingerprinting',
  Content: 'cdn',
  Email: 'uncategorized',
  EmailAggressive: 'uncategorized',
  'Anti-fraud': 'uncategorized',
  ConsentManagers: 'uncategorized',
  Cryptomining: 'uncategorized'
};

/** Fingerprinting API families we detect (plan §4 / Phase 1 wrappers). */
export const FINGERPRINT_API_FAMILIES = ['canvas', 'webgl', 'audio', 'fonts'] as const;
export type FingerprintApiFamily = (typeof FINGERPRINT_API_FAMILIES)[number];

/** Resource types we record per network request. */
export const RESOURCE_TYPES = [
  'document',
  'stylesheet',
  'image',
  'font',
  'script',
  'xhr',
  'fetch',
  'websocket',
  'manifest',
  'other'
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/**
 * Free-tier budgets (Cloudflare Browser Run, verified 2026-10-01 —
 * developers.cloudflare.com/browser-run/limits/). Kept here so the worker,
 * the docs and the methodology page quote the same numbers.
 */
export const FREE_TIER_LIMITS = {
  /** Total browser seconds available per UTC day on the Workers Free plan. */
  browserSecondsPerDay: 600,
  /** Browser seconds we allow live scans to consume per day (headroom kept). */
  liveScanSecondsPerDay: 450,
  /** Hard cap on a single live scan (platform limit is 60s). */
  maxScanDurationMs: 40_000,
  /** New browser instances are limited to 1 per 20s, 3 concurrent. */
  maxConcurrentBrowsers: 3
} as const;

/** Query params stripped from recorded request URLs before storage (plan §4). */
export const SENSITIVE_QUERY_PARAM_PATTERN =
  /^(token|tokens|session|sessionid|sid|key|apikey|api_key|secret|password|pass|passwd|auth|authorization|jwt|code|access_token|refresh_token)$/i;

/** Grades for the privacy score. */
export const SCORE_GRADE_THRESHOLDS = [
  { min: 85, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 55, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'F' }
] as const;
