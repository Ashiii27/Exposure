import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeDisconnect } from '../src/normalize-disconnect.js';
import { normalizeEasyPrivacy } from '../src/normalize-easyprivacy.js';
import { normalizeDdgEntity } from '../src/normalize-ddg.js';
import { mergeLists } from '../src/merge-lists.js';

/** Miniature services.json mirroring the verified upstream structure. */
const disconnectFixture = {
  license: 'fixture',
  categories: {
    Advertising: [
      { Google: { 'http://www.google.com/': ['doubleclick.net', '2mdn.net'] } },
      { '888new': { performance: 'true' } }
    ],
    FingerprintingInvasive: [
      { Google: { 'http://www.google.com/': ['doubleclick.net'] } }
    ],
    Content: [{ Facebook: { 'https://facebook.com/': ['facebook.net'] } }],
    ConsentManagers: [{ 'Onetrust': { 'https://onetrust.com/': ['onetrust.com'] } }]
  }
};

const easyprivacyFixture = [
  '! EasyPrivacy fixture',
  '||doubleclick.net^',
  '||doubleclick.net^$script',
  '||ads.tracker.example^',
  '@@||ads.tracker.example^',
  '/analytics.js',
  '||example.com^$image,third-party',
  '[Adblock Plus 2.0]',
  '##.ad-banner'
].join('\n');

describe('normalizeDisconnect', () => {
  const entries = normalizeDisconnect(disconnectFixture);

  it('extracts domains with company and mapped category', () => {
    const dbl = entries.find((e) => e.domain === 'doubleclick.net');
    expect(dbl?.company).toBe('Google');
    expect(dbl?.category).toBe('advertising');
  });

  it('maps every upstream category into our taxonomy', () => {
    const categories = new Set(entries.map((e) => e.category));
    expect(categories).toEqual(new Set(['advertising', 'fingerprinting', 'cdn', 'uncategorized']));
  });

  it('skips non-domain company values without throwing', () => {
    expect(entries.some((e) => e.company === '888new')).toBe(false);
  });

  it('parses the real upstream file when it has been fetched', () => {
    let raw: string;
    try {
      raw = readFileSync(new URL('../build/raw/disconnect-services.json', import.meta.url), 'utf8');
    } catch {
      return; // not fetched in CI — fixture coverage above is the contract
    }
    const real = normalizeDisconnect(JSON.parse(raw));
    expect(real.length).toBeGreaterThan(1000);
    const google = real.find((e) => e.domain === 'doubleclick.net');
    expect(google?.company).toBe('Google');
  });
});

describe('normalizeEasyPrivacy', () => {
  const result = normalizeEasyPrivacy(easyprivacyFixture);

  it('collects blocked domains, deduplicated', () => {
    expect(result.blockedDomains).toContain('doubleclick.net');
    expect(result.blockedDomains).toContain('example.com');
    expect(result.blockedDomains.filter((d) => d === 'doubleclick.net')).toHaveLength(1);
  });

  it('lets @@ exceptions remove blocks', () => {
    expect(result.blockedDomains).not.toContain('ads.tracker.example');
    expect(result.exceptionDomains).toContain('ads.tracker.example');
  });

  it('skips comments, headers, cosmetic and path rules', () => {
    expect(result.skippedRules).toBe(2); // /analytics.js and ##.ad-banner
  });
});

describe('normalizeDdgEntity', () => {
  it('parses properties and resources with relations', () => {
    const entries = normalizeDdgEntity({
      name: 'Google LLC',
      displayName: 'Google',
      properties: ['2mdn.net', 'doubleclick.net'],
      resources: ['google.com']
    });
    expect(entries).toEqual([
      { domain: '2mdn.net', company: 'Google LLC', relation: 'property' },
      { domain: 'doubleclick.net', company: 'Google LLC', relation: 'property' },
      { domain: 'google.com', company: 'Google LLC', relation: 'resource' }
    ]);
  });

  it('rejects malformed entities', () => {
    expect(() => normalizeDdgEntity({ name: 'x' })).toThrow();
  });
});

describe('mergeLists', () => {
  const index = mergeLists({
    disconnect: normalizeDisconnect(disconnectFixture),
    easyprivacy: normalizeEasyPrivacy(easyprivacyFixture),
    ddg: normalizeDdgEntity({ name: 'Google LLC', properties: ['doubleclick.net'] }),
    cdnAllowlist: ['cdnjs.cloudflare.com']
  });

  it('unions categories and sources across lists', () => {
    const entry = index.entries['doubleclick.net']!;
    expect(entry.categories).toEqual(
      expect.arrayContaining(['advertising', 'fingerprinting'])
    );
    expect(entry.sources).toEqual(expect.arrayContaining(['disconnect', 'ddg', 'easyprivacy']));
    // DDG's canonical entity name ("Google LLC") supplements Disconnect's
    // shorter "Google" — that is the intended merge behaviour.
    expect(entry.company).toBe('Google LLC');
  });

  it('marks allowlisted CDNs as cdn', () => {
    expect(index.entries['cdnjs.cloudflare.com']?.categories).toContain('cdn');
  });

  it('keeps EasyPrivacy-only domains source-tagged but uncategorized', () => {
    // example.com is easyprivacy-only in the fixture and not allowlisted
    expect(index.entries['example.com']?.sources).toEqual(['easyprivacy']);
  });

  it('records list sources and a generation timestamp', () => {
    expect(index.sources).toEqual(['disconnect', 'ddg', 'easyprivacy']);
    expect(index.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
