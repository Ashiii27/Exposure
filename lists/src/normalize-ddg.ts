/**
 * Normalizer for DuckDuckGo Tracker Radar entity files.
 *
 * Verified structure (2026-10-01, entities/<Company>.json):
 *   {
 *     "name": "Google LLC",
 *     "displayName": "Google",
 *     "properties": ["0m66lx69dx.com", "2mdn.net", ...],   // owned
 *     "resources": ["google.com", ...]                      // operated, not owned
 *   }
 *
 * The full dataset is ~5000 per-company files; Phase 2 decides the curated
 * subset to fetch (top entities by prevalence). This normalizer is ready for
 * whichever files land in lists/build/raw/.
 */

export interface DdgEntity {
  name: string;
  displayName?: string;
  properties: string[];
  resources?: string[];
}

export interface DdgRawEntry {
  domain: string;
  company: string;
  /** "property" = owned by the company, "resource" = operated by them. */
  relation: 'property' | 'resource';
}

export function parseDdgEntity(entityJson: unknown): DdgEntity {
  if (!entityJson || typeof entityJson !== 'object') {
    throw new Error('ddg entity: not an object');
  }
  const entity = entityJson as Partial<DdgEntity>;
  if (typeof entity.name !== 'string' || !Array.isArray(entity.properties)) {
    throw new Error('ddg entity: missing "name" or "properties"');
  }
  return {
    name: entity.name,
    displayName: entity.displayName,
    properties: entity.properties.filter((d): d is string => typeof d === 'string'),
    resources: (entity.resources ?? []).filter((d): d is string => typeof d === 'string')
  };
}

export function normalizeDdgEntity(entityJson: unknown): DdgRawEntry[] {
  const entity = parseDdgEntity(entityJson);
  const entries: DdgRawEntry[] = [];
  const seen = new Set<string>();

  for (const [relation, domains] of [
    ['property', entity.properties],
    ['resource', entity.resources ?? []]
  ] as const) {
    for (const domain of domains) {
      const normalized = domain.toLowerCase().replace(/\.$/, '');
      const key = `${normalized}\u0000${relation}`;
      if (seen.has(key) || normalized === '') continue;
      seen.add(key);
      entries.push({ domain: normalized, company: entity.name, relation });
    }
  }

  return entries;
}
