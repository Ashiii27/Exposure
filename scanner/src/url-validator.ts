/**
 * URL validation is security-critical and must not drift between the
 * scanner and the worker — the implementation lives in @exposure/shared.
 * The nightly scanner uses only the static half (its site list is trusted).
 */
export {
  normalizeInputUrl,
  validateUrlSyntax,
  validateResolvedAddresses,
  resolveHostViaDoh,
  validateScanTarget
} from '@exposure/shared';
