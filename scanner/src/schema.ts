/**
 * The scanner produces ScanResult JSON that validates against the shared
 * schema — the same contract the Worker and web consume. Re-exported here so
 * scanner code imports it as it would any local module.
 */
export { ScanResultSchema, redactUrl, isIsoUtc } from '@exposure/shared';
export type { ScanResult } from '@exposure/shared';
