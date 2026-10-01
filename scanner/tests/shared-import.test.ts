import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, ScanResultSchema } from '@exposure/shared';
import { classifyDomain } from '../src/classify.js';
import { FINGERPRINT_INIT_SCRIPT } from '../src/fingerprint-wrappers.js';
import { computeScore } from '../src/scorer.js';

describe('scanner ↔ shared contract', () => {
  it('re-exports the live shared modules (no drift)', () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(() => ScanResultSchema.parse(null)).toThrow();
  });

  it('classifies through the shared engine', () => {
    const result = classifyDomain({
      domain: 'www.example.com',
      requestCount: 1,
      firstPartyRegistrableDomain: 'example.com',
      index: { indexVersion: 0, generatedAt: '1970-01-01T00:00:00.000Z', sources: [], entries: {} }
    });
    expect(result.categories).toEqual(['first-party']);
  });

  it('scores through the shared engine', () => {
    expect(computeScore({
      trackerDomains: 0,
      distinctCompanies: 0,
      fingerprintApiFamilies: 0,
      longLivedCookieCount: 0,
      worstCookieLifetimeDays: null
    }).grade).toBe('A');
  });

  it('ships the init script as a self-contained string', () => {
    expect(FINGERPRINT_INIT_SCRIPT).not.toMatch(/import\s/);
    expect(FINGERPRINT_INIT_SCRIPT).toContain('__exposureFpEvents');
  });
});
