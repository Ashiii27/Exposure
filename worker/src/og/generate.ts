/**
 * Serves OG metadata for a result. Image generation itself happens in the
 * NIGHTLY job (Phase 6) — generating images in the worker would burn Browser
 * Run quota; live results use a static branded card.
 */
export function ogDescription(summary: {
  companiesLearned: number;
  distinctTrackerDomains: number;
}): string {
  if (summary.companiesLearned === 0) {
    return 'No known tracking company saw this visit — see the full X-ray on Exposure.';
  }
  return `${summary.companiesLearned} companies learned you visited this page — ${summary.distinctTrackerDomains} tracker domains. See the full X-ray on Exposure.`;
}
