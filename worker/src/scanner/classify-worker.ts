/**
 * Classification for live scans uses the exact same shared engine as the
 * nightly scanner — one implementation, zero drift.
 */
export { classifyDomain, EMPTY_TRACKERS_INDEX, isTrackerCategory } from '@exposure/shared';
export type { TrackersIndex, DomainClassification } from '@exposure/shared';
