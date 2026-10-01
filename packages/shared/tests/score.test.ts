import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/score.js';

const clean = {
  trackerDomains: 0,
  distinctCompanies: 0,
  fingerprintApiFamilies: 0,
  longLivedCookieCount: 0,
  worstCookieLifetimeDays: null
};

describe('computeScore', () => {
  it('gives a clean page 100/A with an honest sentence', () => {
    const score = computeScore(clean);
    expect(score.value).toBe(100);
    expect(score.grade).toBe('A');
    expect(score.explanation).toMatch(/no known tracking company/);
    expect(score.components).toHaveLength(0);
  });

  it('deducts per tracker-domain tier', () => {
    expect(computeScore({ ...clean, trackerDomains: 1 }).value).toBe(90);
    expect(computeScore({ ...clean, trackerDomains: 4 }).value).toBe(80);
    expect(computeScore({ ...clean, trackerDomains: 10 }).value).toBe(70);
    expect(computeScore({ ...clean, trackerDomains: 25 }).value).toBe(60);
  });

  it('deducts per company-spread tier', () => {
    expect(computeScore({ ...clean, trackerDomains: 3, distinctCompanies: 1 }).value).toBe(87);
    expect(computeScore({ ...clean, trackerDomains: 3, distinctCompanies: 5 }).value).toBe(79);
  });

  it('deducts 5 points per fingerprint family, capped at 25', () => {
    expect(computeScore({ ...clean, fingerprintApiFamilies: 2 }).value).toBe(90);
    expect(computeScore({ ...clean, fingerprintApiFamilies: 4 }).value).toBe(80);
  });

  it('deducts per cookie-lifetime tier', () => {
    expect(computeScore({ ...clean, worstCookieLifetimeDays: 91 }).value).toBe(92);
    expect(computeScore({ ...clean, worstCookieLifetimeDays: 400 }).value).toBe(85);
    expect(computeScore({ ...clean, worstCookieLifetimeDays: 800 }).value).toBe(80);
  });

  it('treats session-only cookies as no deduction', () => {
    expect(computeScore({ ...clean, worstCookieLifetimeDays: null }).value).toBe(100);
  });

  it('hits the worst realistic case: every rule maxes out', () => {
    const score = computeScore({
      trackerDomains: 40,
      distinctCompanies: 12,
      fingerprintApiFamilies: 4,
      longLivedCookieCount: 9,
      worstCookieLifetimeDays: 900
    });
    // 40 + 15 + 20 + 20 = 95 — the maximum the tiers can deduct.
    expect(score.value).toBe(5);
    expect(score.grade).toBe('F');
  });

  it('explains itself in one sentence with the headline first', () => {
    const score = computeScore({
      trackerDomains: 14,
      distinctCompanies: 8,
      fingerprintApiFamilies: 3,
      longLivedCookieCount: 9,
      worstCookieLifetimeDays: 400
    });
    expect(score.explanation).toMatch(/^8 companies learned you visited this page — /);
    expect(score.explanation).toMatch(/cost you \d+ of 100 points\.$/);
    expect(score.components.map((c) => c.rule)).toEqual([
      'tracker-domains',
      'company-spread',
      'fingerprinting',
      'cookie-lifetime'
    ]);
  });

  it('produces the grade boundaries defined in the plan', () => {
    // A >= 85, B >= 70, C >= 55, D >= 40, F < 40 — construct exact deductions.
    expect(computeScore({ ...clean, fingerprintApiFamilies: 3 }).value).toBe(85); // A boundary
    expect(computeScore({ ...clean, fingerprintApiFamilies: 3 }).grade).toBe('A');
    expect(
      computeScore({ ...clean, fingerprintApiFamilies: 3, worstCookieLifetimeDays: 91 }).grade
    ).toBe('B'); // 77
    expect(computeScore({ ...clean, trackerDomains: 10 }).grade).toBe('B'); // 70 boundary
    expect(computeScore({ ...clean, trackerDomains: 20 }).grade).toBe('C'); // 60
    expect(computeScore({ ...clean, trackerDomains: 20, distinctCompanies: 4 }).grade).toBe('D'); // 49
    expect(
      computeScore({
        ...clean,
        trackerDomains: 20,
        distinctCompanies: 7,
        fingerprintApiFamilies: 1,
        worstCookieLifetimeDays: 91
      }).grade
    ).toBe('F'); // 37
  });
});
