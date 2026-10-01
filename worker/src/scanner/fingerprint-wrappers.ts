/**
 * The init script injected before page load on Browser Run scans — the same
 * self-contained string the nightly Playwright scanner injects.
 */
export { FINGERPRINT_INIT_SCRIPT, FINGERPRINT_EVENT_BUFFER } from '@exposure/shared';
export type { RawFingerprintEvent } from '@exposure/shared';
