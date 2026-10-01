/**
 * Normalizer for Disconnect's services.json.
 *
 * Verified structure (2026-10-01):
 *   {
 *     "license": "...",
 *     "categories": {
 *       "Advertising": [
 *         { "Google": { "http://www.google.com/": ["doubleclick.net", ...] } },
 *         ...
 *       ],
 *       ...
 *     }
 *   }
 *
 * Quirks seen in the wild (handled below):
 *   - some company values are not domain maps at all
 *     (e.g. Cryptomining/888new -> { "performance": "true" }) — skipped;
 *   - the same domain can appear under several categories and companies.
 */

import { DISCONNECT_CATEGORY_MAP } from '@exposure/shared';
import type { DomainCategory } from '@exposure/shared';

export interface DisconnectRawEntry {
  domain: string;
  company: string;
  category: DomainCategory;
}

interface ServicesJson {
  categories: Record<string, Array<Record<string, Record<string, unknown>>>>;
}

export function normalizeDisconnect(servicesJson: unknown): DisconnectRawEntry[] {
  const parsed = servicesJson as ServicesJson;
  if (!parsed || typeof parsed !== 'object' || !parsed.categories) {
    throw new Error('disconnect services.json: missing "categories"');
  }

  const entries: DisconnectRawEntry[] = [];
  const seen = new Set<string>();

  for (const [disconnectCategory, companies] of Object.entries(parsed.categories)) {
    const category: DomainCategory = DISCONNECT_CATEGORY_MAP[disconnectCategory] ?? 'uncategorized';
    for (const companyWrapper of companies) {
      for (const [company, websiteMap] of Object.entries(companyWrapper)) {
        if (!websiteMap || typeof websiteMap !== 'object') continue;
        for (const value of Object.values(websiteMap)) {
          if (!Array.isArray(value)) continue; // e.g. { performance: "true" }
          for (const domain of value) {
            if (typeof domain !== 'string' || domain.length === 0) continue;
            const normalized = domain.toLowerCase().replace(/\.$/, '');
            const key = `${normalized}\u0000${category}\u0000${company}`;
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({ domain: normalized, company, category });
          }
        }
      }
    }
  }

  return entries;
}
