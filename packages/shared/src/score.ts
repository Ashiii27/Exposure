/**
 * Exposure — the privacy score (plan §5.3).
 *
 * Starts at 100, deducts, floors at 0. Every deduction is a named component
 * with a human detail string, so the whole score is explainable in one
 * sentence — that sentence is generated too.
 *
 * Weights live inline here for Phase 0; they are calibrated against ~20 real
 * sites in Phase 2 and the rationale recorded in docs/METRICS.md.
 */

import { SCORE_GRADE_THRESHOLDS } from './constants.js';
import type { Score, ScoreComponent } from './schema.js';

export interface ScoreInput {
  /** Distinct third-party domains classified as trackers. */
  trackerDomains: number;
  /** Distinct companies behind those trackers. */
  distinctCompanies: number;
  /** How many of the four fingerprint API families were called (0–4). */
  fingerprintApiFamilies: number;
  /** Third-party cookies that outlive a year. */
  longLivedCookieCount: number;
  /** Worst third-party cookie lifetime in days; null = only session cookies. */
  worstCookieLifetimeDays: number | null;
}

const TRACKER_TIERS = [
  { min: 20, points: 40 },
  { min: 10, points: 30 },
  { min: 4, points: 20 },
  { min: 1, points: 10 }
] as const;

const COMPANY_TIERS = [
  { min: 7, points: 15 },
  { min: 4, points: 11 },
  { min: 2, points: 7 },
  { min: 1, points: 3 }
] as const;

const FINGERPRINT_POINTS_PER_FAMILY = 5;
const FINGERPRINT_MAX = 25;

const COOKIE_TIERS = [
  { minDays: 730, points: 20 },
  { minDays: 365, points: 15 },
  { minDays: 90, points: 8 }
] as const;

export function computeScore(input: ScoreInput): Score {
  const components: ScoreComponent[] = [];

  const trackerTier = TRACKER_TIERS.find((tier) => input.trackerDomains >= tier.min);
  if (trackerTier) {
    components.push({
      rule: 'tracker-domains',
      points: trackerTier.points,
      detail: `${input.trackerDomains} tracker ${input.trackerDomains === 1 ? 'domain' : 'domains'}`
    });
  }

  const companyTier = COMPANY_TIERS.find((tier) => input.distinctCompanies >= tier.min);
  if (companyTier) {
    components.push({
      rule: 'company-spread',
      points: companyTier.points,
      detail: `${input.distinctCompanies} ${input.distinctCompanies === 1 ? 'company' : 'companies'}`
    });
  }

  if (input.fingerprintApiFamilies > 0) {
    components.push({
      rule: 'fingerprinting',
      points: Math.min(input.fingerprintApiFamilies * FINGERPRINT_POINTS_PER_FAMILY, FINGERPRINT_MAX),
      detail: `${input.fingerprintApiFamilies} fingerprinting API ${input.fingerprintApiFamilies === 1 ? 'family' : 'families'}`
    });
  }

  // A null lifetime means only session cookies were seen — no deduction.
  // (Calibration note, Phase 2: the original plan treated "no expiry set" as
  // worst-tier; in cookie semantics that IS a session cookie, so we don't.)
  const worstDays = input.worstCookieLifetimeDays;
  if (worstDays !== null) {
    const cookieTier = COOKIE_TIERS.find((tier) => worstDays >= tier.minDays);
    if (cookieTier) {
      components.push({
        rule: 'cookie-lifetime',
        points: cookieTier.points,
        detail: `cookies lasting ${describeLifetime(worstDays)}`
      });
    }
  }

  const total = components.reduce((sum, component) => sum + component.points, 0);
  const value = Math.max(0, 100 - total);
  const grade = gradeFor(value);

  return {
    value,
    grade,
    components,
    explanation: explain({ ...input, grade, value })
  };
}

function gradeFor(value: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  for (const threshold of SCORE_GRADE_THRESHOLDS) {
    if (value >= threshold.min) return threshold.grade;
  }
  return 'F';
}

function describeLifetime(days: number): string {
  if (days >= 730) return 'over two years';
  if (days >= 365) return 'over a year';
  return 'over 90 days';
}

function explain(input: ScoreInput & { value: number; grade: string }): string {
  const parts: string[] = [];

  if (input.distinctCompanies > 0) {
    parts.push(
      `${input.distinctCompanies} ${input.distinctCompanies === 1 ? 'company' : 'companies'} learned you visited this page`
    );
  } else {
    parts.push('no known tracking company saw this visit');
  }

  const details: string[] = [];
  if (input.trackerDomains > 0) {
    details.push(`${input.trackerDomains} tracker ${input.trackerDomains === 1 ? 'domain' : 'domains'}`);
  }
  if (input.fingerprintApiFamilies > 0) {
    details.push(`${input.fingerprintApiFamilies} fingerprinting API ${input.fingerprintApiFamilies === 1 ? 'family' : 'families'}`);
  }
  if (input.longLivedCookieCount > 0) {
    details.push(
      `${input.longLivedCookieCount} ${input.longLivedCookieCount === 1 ? 'cookie' : 'cookies'} that outlive a year`
    );
  }

  const lost = 100 - input.value;
  const scorePart = lost > 0 ? `cost you ${lost} of 100 points` : 'left your score untouched';

  if (details.length > 0) {
    return `${parts[0]} — ${details.join(', ')} ${scorePart}.`;
  }
  return `${parts[0]} — nothing suspicious was observed.`;
}
