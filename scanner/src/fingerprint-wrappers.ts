/**
 * The fingerprint-detection init script is a shared, self-contained string —
 * identical bytes are injected by the nightly Playwright scanner and by the
 * Cloudflare Browser Run worker. The full wrapper set lands in Phase 1.
 */
export { FINGERPRINT_INIT_SCRIPT, FINGERPRINT_EVENT_BUFFER } from '@exposure/shared';
export type { RawFingerprintEvent } from '@exposure/shared';
