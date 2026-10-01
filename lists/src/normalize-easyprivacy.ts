/**
 * Normalizer for EasyPrivacy (EasyList syntax).
 *
 * We deliberately use only the hostname-rule subset of the syntax:
 *   ||example.com^        -> block rule for the domain (and subdomains)
 *   @@||example.com^      -> exception rule (removes the block)
 * Everything else (regex rules, path rules like /track^, cosmetic rules)
 * is out of scope and skipped — documented in docs/METHODOLOGY.md.
 *
 * License: GPLv3 / CC BY-SA 3.0 dual — never commit the raw list.
 */

export interface EasyPrivacyResult {
  blockedDomains: string[];
  exceptionDomains: string[];
  skippedRules: number;
}

const HOSTNAME_RULE = /^\|\|([a-z0-9.-]+)\^/;

export function normalizeEasyPrivacy(listText: string): EasyPrivacyResult {
  const blocked = new Set<string>();
  const exceptions = new Set<string>();
  let skipped = 0;

  for (const rawLine of listText.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('!') || line.startsWith('[')) continue;

    const isException = line.startsWith('@@');
    const body = isException ? line.slice(2) : line;

    const match = HOSTNAME_RULE.exec(body);
    if (!match) {
      skipped++;
      continue;
    }

    const domain = match[1]!.toLowerCase().replace(/\.$/, '');
    // Rules with additional constraints ($script, $image, ...) still tell us
    // the domain is tracker infrastructure; the option is not preserved.
    if (isException) exceptions.add(domain);
    else blocked.add(domain);
  }

  // An @@ exception wins over the block rule for the same domain.
  for (const domain of exceptions) blocked.delete(domain);

  return {
    blockedDomains: [...blocked].sort(),
    exceptionDomains: [...exceptions].sort(),
    skippedRules: skipped
  };
}
