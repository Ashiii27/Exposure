import { describe, expect, it } from 'vitest';
import { classifyDomain, EMPTY_TRACKERS_INDEX, isTrackerCategory } from '../src/classify.js';
import type { TrackersIndex } from '../src/classify.js';

const index: TrackersIndex = {
  indexVersion: 1,
  generatedAt: '2026-10-01T00:00:00.000Z',
  sources: ['disconnect', 'ddg'],
  entries: {
    'doubleclick.net': {
      categories: ['advertising', 'fingerprinting'],
      company: 'Google LLC',
      sources: ['disconnect']
    },
    'facebook.net': { categories: ['social'], company: 'Meta', sources: ['disconnect'] },
    'stats.g.doubleclick.net': {
      categories: ['advertising'],
      company: 'Google LLC',
      sources: ['ddg']
    }
  }
};

const base = {
  domain: 'example.com',
  requestCount: 3,
  firstPartyRegistrableDomain: 'example.com',
  index
};

describe('classifyDomain', () => {
  it('marks the site itself first-party, including www and deeper subdomains', () => {
    expect(classifyDomain(base).categories).toEqual(['first-party']);
    expect(classifyDomain({ ...base, domain: 'www.example.com' }).isFirstParty).toBe(true);
    expect(classifyDomain({ ...base, domain: 'cdn.assets.example.com' }).isFirstParty).toBe(true);
  });

  it('does not let a suffix spoof first-party status', () => {
    expect(classifyDomain({ ...base, domain: 'example.com.evil.net' }).isFirstParty).toBe(false);
    expect(classifyDomain({ ...base, domain: 'notexample.com' }).isFirstParty).toBe(false);
  });

  it('classifies known tracker domains with company and source', () => {
    const result = classifyDomain({ ...base, domain: 'doubleclick.net' });
    expect(result.categories).toEqual(['advertising', 'fingerprinting']);
    expect(result.company).toBe('Google LLC');
    expect(result.sources).toEqual(['disconnect']);
    expect(result.isFirstParty).toBe(false);
  });

  it('lets subdomains inherit a parent classification', () => {
    const result = classifyDomain({ ...base, domain: 'ad.doubleclick.net' });
    expect(result.company).toBe('Google LLC');
    expect(result.categories).toContain('advertising');
  });

  it('prefers the most specific index key when one exists', () => {
    const result = classifyDomain({ ...base, domain: 'stats.g.doubleclick.net' });
    expect(result.categories).toEqual(['advertising']);
    expect(result.sources).toEqual(['ddg']);
  });

  it('returns uncategorized for unknown third-party domains', () => {
    const result = classifyDomain({ ...base, domain: 'unknown-tracker.io' });
    expect(result.categories).toEqual(['uncategorized']);
    expect(result.company).toBeNull();
  });

  it('marks allowlisted CDNs as cdn', () => {
    const result = classifyDomain({
      ...base,
      domain: 'cdn.jsdelivr.net',
      cdnAllowlist: new Set(['jsdelivr.net', 'cdnjs.cloudflare.com'])
    });
    expect(result.categories).toEqual(['cdn']);
    expect(result.sources).toEqual(['cdn-allowlist']);
  });

  it('works against an empty index', () => {
    const result = classifyDomain({ ...base, domain: 'doubleclick.net', index: EMPTY_TRACKERS_INDEX });
    expect(result.categories).toEqual(['uncategorized']);
  });
});

describe('isTrackerCategory', () => {
  it('separates trackers from everything else', () => {
    expect(isTrackerCategory('advertising')).toBe(true);
    expect(isTrackerCategory('fingerprinting')).toBe(true);
    expect(isTrackerCategory('cdn')).toBe(false);
    expect(isTrackerCategory('first-party')).toBe(false);
    expect(isTrackerCategory('uncategorized')).toBe(false);
  });
});
