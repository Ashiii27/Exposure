/**
 * Exposure — URL validation for visitor-supplied scan targets (plan §6).
 *
 * Exposure makes the server's browser fetch arbitrary visitor-chosen URLs.
 * That is SSRF territory and these rules are the defence. They live in the
 * shared package so the nightly scanner, the live-scan Worker and the tests
 * all enforce exactly the same policy:
 *
 *   1. only http/https
 *   2. no userinfo, no non-standard ports (80/443 only), length cap
 *   3. hostname must be a real DNS name — no raw IPs, localhost, dotless,
 *      *.local/*.internal
 *   4. DNS is resolved by us (DoH from the Worker) and every resolved
 *      address is checked against forbidden ranges
 *   5. the check is re-run after every redirect (worker, Phase 5)
 *
 * The two halves below are deliberately pure and separate:
 *   - `validateUrlSyntax` — static checks, no network
 *   - `validateResolvedAddresses` — checks a list of already-resolved IPs
 * so both can be exhaustively unit-tested without touching the network.
 */

import ipaddr from 'ipaddr.js';

export type UrlValidation =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export type AddressValidation =
  | { ok: true; addresses: string[] }
  | { ok: false; reason: string; addresses: string[] };

const MAX_URL_LENGTH = 2048;
const MAX_HOSTNAME_LENGTH = 253;
const ALLOWED_PORTS = new Set(['', '80', '443']);

/** Hostnames that are never DNS names we want to scan. */
const FORBIDDEN_HOSTNAME_SUFFIXES = ['.local', '.internal', '.lan', '.home', '.corp'];

/**
 * Accepts what a visitor types ("example.com", "https://x.y/path") and returns
 * a normalized URL. Does no security checks — pair with validateUrlSyntax.
 */
export function normalizeInputUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/**
 * Static validation of the target URL (no DNS, no network).
 * Returns the validated URL on success.
 */
export function validateUrlSyntax(input: URL | string): UrlValidation {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    return { ok: false, reason: 'not a parseable URL' };
  }

  if (url.toString().length > MAX_URL_LENGTH) {
    return { ok: false, reason: `URL longer than ${MAX_URL_LENGTH} characters` };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `scheme "${url.protocol.replace(':', '')}" is not allowed (http/https only)` };
  }

  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'userinfo (user:pass@) in URL is not allowed' };
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: `port ${url.port} is not allowed (80/443 only)` };
  }

  // Normalize: lowercase, strip one trailing dot (legal FQDN form).
  const hostname = url.hostname.replace(/\.$/, '').toLowerCase();

  if (hostname.length === 0 || hostname.length > MAX_HOSTNAME_LENGTH) {
    return { ok: false, reason: 'hostname has invalid length' };
  }

  // Any label being "localhost" (localhost, sub.localhost,
  // localhost.localdomain) is a loopback name, not a real site.
  if (hostname.split('.').includes('localhost') || hostname.endsWith('.localdomain')) {
    return { ok: false, reason: 'localhost is not allowed' };
  }

  if (!hostname.includes('.')) {
    return { ok: false, reason: 'hostname is not a fully-qualified domain name' };
  }

  for (const suffix of FORBIDDEN_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return { ok: false, reason: `internal hostname suffix "${suffix}" is not allowed` };
    }
  }

  // Raw IPv6 (URL hostnames with colons are always bracketed IPv6 literals).
  if (hostname.includes(':')) {
    return { ok: false, reason: 'raw IP addresses are not allowed' };
  }

  // Raw IPv4 in any dotted/decimal/hex form a URL parser will pass through
  // (e.g. 1.2.3.4, 2130706433, 0x7f.0.0.1 — some resolvers expand these).
  if (/^\d+(\.\d+)*$/.test(hostname) || /^[0-9a-f]+(\.[0-9a-f]+)*$/i.test(hostname)) {
    return { ok: false, reason: 'raw IP addresses are not allowed' };
  }

  if (url.protocol === 'https:' && url.pathname === '' && url.href.endsWith('//')) {
    return { ok: false, reason: 'malformed URL' };
  }

  return { ok: true, url };
}

/** ipaddr.js ranges (v4 and v6) we refuse to connect to. */
const FORBIDDEN_IPV4_RANGES = new Set([
  'unspecified', // 0.0.0.0/8
  'loopback', // 127.0.0.0/8
  'private', // 10/8, 172.16/12, 192.168/16
  'linkLocal', // 169.254.0.0/16 — includes cloud metadata 169.254.169.254
  'multicast', // 224.0.0.0/4
  'reserved',
  'broadcast'
]);

const FORBIDDEN_IPV6_RANGES = new Set([
  'unspecified', // ::
  'loopback', // ::1
  'linkLocal', // fe80::/10
  'uniqueLocal', // fc00::/7
  'multicast', // ff00::/8
  'reserved'
]);

/** CGNAT 100.64.0.0/10 is not in every ipaddr.js range table — checked manually. */
const CGNAT_SUBNET = ipaddr.parseCIDR('100.64.0.0/10');

/**
 * Validate addresses that a hostname resolved to. Every address must be
 * public; one bad address rejects the whole resolution (a hostname that
 * resolves to both a public and a private IP is still an SSRF vector).
 */
export function validateResolvedAddresses(addresses: readonly string[]): AddressValidation {
  const seen: string[] = [];
  for (const raw of addresses) {
    let addr;
    try {
      addr = ipaddr.parse(raw.trim());
    } catch {
      return { ok: false, reason: `"${raw}" is not a parseable IP address`, addresses: seen };
    }
    seen.push(addr.toString());

    if (addr.kind() === 'ipv4') {
      const reason = checkIpv4(addr as ipaddr.IPv4);
      if (reason) return { ok: false, reason, addresses: seen };
    } else {
      const reason = checkIpv6(addr as ipaddr.IPv6);
      if (reason) return { ok: false, reason, addresses: seen };
    }
  }
  return { ok: true, addresses: seen };
}

function checkIpv4(addr: ipaddr.IPv4): string | null {
  const range = addr.range();
  if (FORBIDDEN_IPV4_RANGES.has(range)) {
    return `resolved address ${addr.toString()} is in a forbidden range (${range})`;
  }
  if (addr.match(CGNAT_SUBNET)) {
    return `resolved address ${addr.toString()} is in carrier-grade NAT space (100.64.0.0/10)`;
  }
  return null;
}

function checkIpv6(addr: ipaddr.IPv6): string | null {
  // IPv4-mapped (::ffff:a.b.c.d) must be checked as IPv4 too.
  if (addr.isIPv4MappedAddress()) {
    return checkIpv4(addr.toIPv4Address());
  }
  const range = addr.range();
  if (FORBIDDEN_IPV6_RANGES.has(range)) {
    return `resolved address ${addr.toString()} is in a forbidden range (${range})`;
  }
  return null;
}

/**
 * Resolve a hostname via DNS-over-HTTPS (runs in the Worker, where we must
 * not trust the platform resolver blindly). `fetchImpl` is injectable so
 * tests can mock it. Returns all A/AAAA records found.
 */
export async function resolveHostViaDoh(
  hostname: string,
  fetchImpl: typeof fetch = fetch,
  endpoint = 'https://cloudflare-dns.com/dns-query'
): Promise<string[]> {
  const types = ['A', 'AAAA'] as const;
  const addresses: string[] = [];
  for (const type of types) {
    const response = await fetchImpl(`${endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`, {
      headers: { accept: 'application/dns-json' }
    });
    if (!response.ok) {
      throw new Error(`DoH lookup failed for ${hostname} (${type}): ${response.status}`);
    }
    const body = (await response.json()) as DohResponse;
    if (body.Status !== 0 || !Array.isArray(body.Answer)) continue;
    for (const answer of body.Answer) {
      // type 1 = A, type 28 = AAAA; ignore CNAME chains (type 5).
      if ((type === 'A' && answer.type === 1) || (type === 'AAAA' && answer.type === 28)) {
        addresses.push(answer.data);
      }
    }
  }
  return addresses;
}

interface DohResponse {
  Status: number;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
}

/**
 * Full static + DNS validation for a visitor-supplied target.
 * The Worker calls this; the nightly scanner calls only the static half
 * (its site list is trusted and checked in).
 */
export async function validateScanTarget(
  raw: string,
  fetchImpl: typeof fetch = fetch
): Promise<UrlValidation> {
  const normalized = normalizeInputUrl(raw);
  if (!normalized) return { ok: false, reason: 'not a parseable URL' };

  const syntax = validateUrlSyntax(normalized);
  if (!syntax.ok) return syntax;

  try {
    const addresses = await resolveHostViaDoh(syntax.url.hostname, fetchImpl);
    if (addresses.length === 0) {
      return { ok: false, reason: 'hostname does not resolve' };
    }
    const addressCheck = validateResolvedAddresses(addresses);
    if (!addressCheck.ok) return { ok: false, reason: addressCheck.reason };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? `DNS resolution failed: ${error.message}` : 'DNS resolution failed'
    };
  }

  return { ok: true, url: syntax.url };
}
