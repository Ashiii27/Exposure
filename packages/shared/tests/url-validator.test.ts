import { describe, expect, it } from 'vitest';
import {
  normalizeInputUrl,
  validateResolvedAddresses,
  validateUrlSyntax,
  validateScanTarget
} from '../src/url-validator.js';

const ok = (url: string) => validateUrlSyntax(url);

describe('normalizeInputUrl', () => {
  it('adds https:// when no scheme is present', () => {
    expect(normalizeInputUrl('example.com')?.href).toBe('https://example.com/');
  });

  it('keeps an explicit scheme', () => {
    expect(normalizeInputUrl('http://example.com')?.protocol).toBe('http:');
  });

  it('rejects empty and oversized input', () => {
    expect(normalizeInputUrl('   ')).toBeNull();
    expect(normalizeInputUrl('https://example.com/' + 'a'.repeat(3000))).toBeNull();
  });
});

describe('validateUrlSyntax — accepted', () => {
  it.each([
    'https://example.com/',
    'http://example.com',
    'https://news.example.co.uk/article?a=1#frag',
    'https://example.com.', // trailing-dot FQDN form
    'https://EXAMPLE.com/', // upper-case host
    'https://example.com:443/',
    'http://example.com:80/'
  ])('%s', (url) => {
    expect(ok(url).ok).toBe(true);
  });
});

describe('validateUrlSyntax — rejected (scheme / URL shape)', () => {
  it.each([
    ['ftp://example.com/', 'non-http scheme'],
    ['file:///etc/passwd', 'file scheme'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['data:text/html,hi', 'data scheme'],
    ['https://user:pass@example.com/', 'userinfo'],
    ['https://user@example.com/', 'username only'],
    ['https://example.com:8080/', 'non-standard port'],
    ['https://example.com:22/', 'ssh port'],
    ['https://example.com:0/', 'port 0'],
    ['https://' + 'a'.repeat(300) + '.com/', 'oversized hostname']
  ])('%s (%s)', (url) => {
    const result = ok(url);
    expect(result.ok).toBe(false);
  });
});

describe('validateUrlSyntax — rejected (SSRF targets)', () => {
  it.each([
    'https://localhost/',
    'https://localhost.localdomain/',
    'https://sub.localhost/',
    'http://127.0.0.1/',
    'http://2130706433/', // 127.0.0.1 as a decimal integer
    'http://0x7f.0.0.1/', // hex form
    'http://0.0.0.0/',
    'http://[::1]/', // raw IPv6
    'http://[fe80::1]/',
    'https://intranet/', // dotless internal name
    'https://printer.local/',
    'https://wiki.internal/',
    'https://git.corp/',
    'https://foo.lan/'
  ])('%s', (url) => {
    const result = ok(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(5);
  });
});

describe('validateResolvedAddresses', () => {
  it('accepts public addresses', () => {
    const result = validateResolvedAddresses(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']);
    expect(result.ok).toBe(true);
  });

  it('rejects private, loopback, link-local and metadata ranges', () => {
    const bad = [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '100.64.0.1', // CGNAT
      '::1',
      'fe80::1',
      'fc00::1',
      'fd12:3456:789a::1',
      'ff02::1',
      '::'
    ];
    for (const address of bad) {
      const result = validateResolvedAddresses([address]);
      expect(result.ok, address).toBe(false);
    }
  });

  it('rejects IPv4-mapped IPv6 that hides a private address', () => {
    const result = validateResolvedAddresses(['::ffff:10.0.0.1']);
    expect(result.ok).toBe(false);
  });

  it('rejects a hostname mixing public and private addresses', () => {
    const result = validateResolvedAddresses(['93.184.216.34', '192.168.0.10']);
    expect(result.ok).toBe(false);
  });

  it('rejects unparseable input', () => {
    expect(validateResolvedAddresses(['not-an-ip']).ok).toBe(false);
  });
});

describe('validateScanTarget (DoH mocked)', () => {
  const doh = (ips: string[]) =>
    ((async () => ({
      ok: true,
      status: 200,
      json: async () => ({ Status: 0, Answer: ips.map((data) => ({ name: 'x', type: data.includes(':') ? 28 : 1, TTL: 60, data })) })
    })) as unknown) as typeof fetch;

  it('accepts a public target end to end', async () => {
    const result = await validateScanTarget('example.com', doh(['93.184.216.34']));
    expect(result.ok).toBe(true);
  });

  it('rejects a target whose DNS points at a metadata service', async () => {
    const result = await validateScanTarget('attacker.example', doh(['169.254.169.254']));
    expect(result.ok).toBe(false);
  });

  it('rejects when nothing resolves', async () => {
    const empty = ((async () => ({ ok: true, status: 200, json: async () => ({ Status: 3 }) })) as unknown) as typeof fetch;
    const result = await validateScanTarget('nonexistent.example', empty);
    expect(result.ok).toBe(false);
  });
});
