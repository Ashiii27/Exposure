/**
 * SSRF validation for visitor-supplied URLs — the shared implementation.
 * The worker adds the DNS half (DoH resolution) on top of the static rules;
 * the full flow (validate → re-check after every redirect) is Phase 5.
 */
export {
  normalizeInputUrl,
  validateUrlSyntax,
  validateResolvedAddresses,
  resolveHostViaDoh,
  validateScanTarget
} from '@exposure/shared';
