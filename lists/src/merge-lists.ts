/**
 * Merge normalized tracker lists into the single TrackersIndex consumed by
 * @exposure/shared's classifyDomain (plan §5.1).
 *
 * Precedence: Disconnect (entity + category data) supplements DDG entities
 * (company names); EasyPrivacy adds hostname coverage without categories;
 * the CDN allowlist downgrades neutral infra to `cdn`. Tuning is Phase 2.
 */

import type { DomainCategory, TrackersIndex, TrackerListSource } from '@exposure/shared';
import type { DisconnectRawEntry } from './normalize-disconnect.js';
import type { EasyPrivacyResult } from './normalize-easyprivacy.js';
import type { DdgRawEntry } from './normalize-ddg.js';

export interface MergeInput {
  disconnect: DisconnectRawEntry[];
  easyprivacy: EasyPrivacyResult;
  ddg: DdgRawEntry[];
  cdnAllowlist: string[];
}

interface Accumulated {
  categories: Set<DomainCategory>;
  company: string | null;
  sources: Set<TrackerListSource>;
}

function categorize(domain: string, allowlist: ReadonlySet<string>): DomainCategory | null {
  return allowlist.has(domain) ? 'cdn' : null;
}

export function mergeLists(input: MergeInput): TrackersIndex {
  const entries = new Map<string, Accumulated>();
  const cdnAllowlist = new Set(input.cdnAllowlist.map((d) => d.toLowerCase()));

  const accumulate = (
    domain: string,
    mutate: (entry: Accumulated) => void
  ) => {
    let entry = entries.get(domain);
    if (!entry) {
      entry = { categories: new Set(), company: null, sources: new Set() };
      entries.set(domain, entry);
    }
    mutate(entry);
  };

  // 1. Disconnect — categories + company.
  for (const { domain, company, category } of input.disconnect) {
    accumulate(domain, (entry) => {
      entry.categories.add(category);
      entry.company ??= company;
      entry.sources.add('disconnect');
    });
  }

  // 2. DDG Tracker Radar — company (property relation wins over resource).
  for (const { domain, company, relation } of input.ddg) {
    accumulate(domain, (entry) => {
      entry.company ??= company;
      if (relation === 'property' || !entry.company) entry.company = company;
      entry.sources.add('ddg');
    });
  }

  // 3. EasyPrivacy — hostname coverage only.
  for (const domain of input.easyprivacy.blockedDomains) {
    accumulate(domain, (entry) => {
      entry.sources.add('easyprivacy');
    });
  }

  // 4. CDN allowlist — downgrade neutral infra to cdn (never removes tracker
  //    categories that real lists assigned; allowlist entries are curated to
  //    be tracker-free, so in practice they only gain 'cdn').
  for (const domain of cdnAllowlist) {
    const downgrade = categorize(domain, cdnAllowlist);
    if (downgrade) {
      accumulate(domain, (entry) => entry.categories.add(downgrade));
    }
  }

  const index: TrackersIndex = {
    indexVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: ['disconnect', 'ddg', 'easyprivacy'],
    entries: {}
  };

  for (const [domain, entry] of entries) {
    index.entries[domain] = {
      categories: [...entry.categories],
      company: entry.company,
      sources: [...entry.sources]
    };
  }

  return index;
}
