/**
 * Exposure — domain classification (plan §5).
 *
 * Maps each contacted domain to categories (advertising, analytics, social,
 * fingerprinting, cdn, first-party, uncategorized) and to the company that
 * owns it, by matching against a merged index built from Disconnect,
 * DuckDuckGo Tracker Radar and EasyPrivacy (see the lists package).
 *
 * Phase 0 ships the matching engine and the index types; the index itself is
 * produced by `lists/src/merge-lists.ts` and tuned in Phase 2.
 */

import type { DomainCategory } from './constants.js';
import type { DomainClassification, TrackerListSource } from './schema.js';
import { TRACKER_CATEGORIES } from './constants.js';

export interface TrackerIndexEntry {
  /** Categories the merged lists assign to this domain. */
  categories: DomainCategory[];
  /** Owning company, when any list provides entity data. */
  company: string | null;
  /** Which lists contributed to this entry. */
  sources: TrackerListSource[];
}

/** domain (registrable or subdomain) → entry. Built by the lists package. */
export interface TrackersIndex {
  indexVersion: number;
  generatedAt: string;
  sources: TrackerListSource[];
  entries: Record<string, TrackerIndexEntry>;
}

export const EMPTY_TRACKERS_INDEX: TrackersIndex = {
  indexVersion: 0,
  generatedAt: '1970-01-01T00:00:00.000Z',
  sources: [],
  entries: {}
};

export interface DomainClassificationInput {
  domain: string;
  requestCount: number;
  /** Registrable domain of the scanned site (e.g. "example.com"). */
  firstPartyRegistrableDomain: string;
  index: TrackersIndex;
  /** Hand-curated neutral CDNs (lists/cdn-allowlist.json). */
  cdnAllowlist?: ReadonlySet<string>;
}

/**
 * Classify one contacted domain.
 *
 * Matching walks up the label chain (a.b.doubleclick.net → doubleclick.net)
 * so subdomains inherit their parent's classification. The first match wins;
 * index keys are expected to be the most specific form each list provides.
 */
export function classifyDomain(input: DomainClassificationInput): DomainClassification {
  const domain = input.domain.toLowerCase().replace(/\.$/, '');
  const firstParty = input.firstPartyRegistrableDomain.toLowerCase().replace(/\.$/, '');

  const isFirstParty =
    domain === firstParty ||
    domain.endsWith(`.${firstParty}`) ||
    registrableSuffixOf(domain) === firstParty;

  if (isFirstParty) {
    return {
      domain,
      requestCount: input.requestCount,
      categories: ['first-party'],
      company: null,
      isFirstParty: true,
      sources: []
    };
  }

  const entry = lookup(domain, input.index);
  if (entry) {
    return {
      domain,
      requestCount: input.requestCount,
      categories: entry.categories.length > 0 ? entry.categories : ['uncategorized'],
      company: entry.company,
      isFirstParty: false,
      sources: entry.sources
    };
  }

  if (input.cdnAllowlist?.has(domain) || (input.cdnAllowlist && suffixListed(domain, input.cdnAllowlist))) {
    return {
      domain,
      requestCount: input.requestCount,
      categories: ['cdn'],
      company: null,
      isFirstParty: false,
      sources: ['cdn-allowlist']
    };
  }

  return {
    domain,
    requestCount: input.requestCount,
    categories: ['uncategorized'],
    company: null,
    isFirstParty: false,
    sources: []
  };
}

/** Does this domain's classification make it a tracker? */
export function isTrackerCategory(category: DomainCategory): boolean {
  return TRACKER_CATEGORIES.includes(category);
}

// -- internals --------------------------------------------------------------

function lookup(domain: string, index: TrackersIndex): TrackerIndexEntry | null {
  if (domain === '') return null;
  if (index.entries[domain]) return index.entries[domain]!;
  const firstDot = domain.indexOf('.');
  if (firstDot === -1) return null;
  return lookup(domain.slice(firstDot + 1), index);
}

function suffixListed(domain: string, allowlist: ReadonlySet<string>): boolean {
  let candidate = domain;
  while (candidate.includes('.')) {
    const next = candidate.slice(candidate.indexOf('.') + 1);
    if (allowlist.has(next)) return true;
    candidate = next;
  }
  return false;
}

/**
 * Cheap fallback for "is this the same site?" when the public-suffix library
 * (tldts, added in Phase 2) is not available: the last two labels.
 * Known-wrong for co.uk-style suffixes; only used until Phase 2 lands.
 */
function registrableSuffixOf(domain: string): string {
  const labels = domain.split('.');
  if (labels.length < 2) return domain;
  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
}
