import { describe, expect, it } from 'vitest';
import { ScanResultSchema, redactUrl, isIsoUtc } from '../src/schema.js';

const validResult = {
  schemaVersion: 1,
  scannerVersion: '0.1.0',
  source: 'nightly',
  requestedUrl: 'https://example.com/',
  finalUrl: 'https://www.example.com/',
  timestamp: '2026-10-01T03:12:44.000Z',
  scanDurationMs: 14200,
  redirects: [{ url: 'https://example.com/', status: 301, location: 'https://www.example.com/', atMs: 90 }],
  requests: [
    {
      id: 1,
      url: 'https://www.example.com/',
      domain: 'www.example.com',
      isThirdParty: false,
      resourceType: 'document',
      method: 'GET',
      status: 200,
      sizeBytes: 12345,
      startMs: 0,
      endMs: 340,
      initiatorDomain: null
    }
  ],
  cookies: [
    {
      name: '_gid',
      domain: '.example.com',
      valueLength: 26,
      secure: true,
      httpOnly: false,
      sameSite: 'Lax',
      expiresAt: '2026-10-08T03:12:44.000Z',
      lifetimeDays: 7,
      isThirdParty: false
    }
  ],
  storage: [{ type: 'localStorage', domain: 'www.example.com', key: 'theme', valueLength: 5 }],
  fingerprinting: [],
  domains: [
    {
      domain: 'www.example.com',
      requestCount: 1,
      categories: ['first-party'],
      company: null,
      isFirstParty: true,
      sources: []
    }
  ],
  score: {
    value: 97,
    grade: 'A',
    components: [],
    explanation: 'no known tracking company saw this visit — nothing suspicious was observed.'
  },
  summary: {
    totalRequests: 1,
    thirdPartyRequests: 0,
    distinctDomains: 1,
    distinctTrackerDomains: 0,
    companiesLearned: 0,
    cookieCount: 1,
    longLivedCookieCount: 0,
    fingerprintApiFamilies: [],
    companies: []
  }
};

describe('ScanResultSchema', () => {
  it('accepts a valid result', () => {
    const parsed = ScanResultSchema.safeParse(validResult);
    expect(parsed.success).toBe(true);
  });

  it('rejects the wrong schema version', () => {
    const parsed = ScanResultSchema.safeParse({ ...validResult, schemaVersion: 2 });
    expect(parsed.success).toBe(false);
  });

  it('rejects a bad timestamp', () => {
    const parsed = ScanResultSchema.safeParse({ ...validResult, timestamp: '2026-10-01 03:12:44' });
    expect(parsed.success).toBe(false);
  });

  it('rejects an out-of-range score', () => {
    const parsed = ScanResultSchema.safeParse({
      ...validResult,
      score: { ...validResult.score, value: 140 }
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown category', () => {
    const parsed = ScanResultSchema.safeParse({
      ...validResult,
      domains: [{ ...validResult.domains[0], categories: ['malware'] }]
    });
    expect(parsed.success).toBe(false);
  });
});

describe('redactUrl', () => {
  it('redacts sensitive query parameters', () => {
    expect(redactUrl('https://x.com/p?token=abc&ok=1')).toBe('https://x.com/p?token=%5Bredacted%5D&ok=1');
  });

  it('leaves clean URLs untouched', () => {
    expect(redactUrl('https://x.com/p?id=7')).toBe('https://x.com/p?id=7');
  });

  it('passes through garbage without throwing', () => {
    expect(redactUrl('not a url')).toBe('not a url');
  });
});

describe('isIsoUtc', () => {
  it('accepts ISO-8601 UTC timestamps', () => {
    expect(isIsoUtc('2026-10-01T03:12:44Z')).toBe(true);
    expect(isIsoUtc('2026-10-01T03:12:44.123Z')).toBe(true);
  });

  it('rejects other date forms', () => {
    expect(isIsoUtc('2026-10-01T03:12:44+02:00')).toBe(false);
    expect(isIsoUtc('2026-10-01')).toBe(false);
  });
});
