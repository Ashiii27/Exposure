/**
 * Classification lives in @exposure/shared so scanner and worker can never
 * disagree about what a domain is. The scanner loads the merged index
 * produced by the lists package and calls into shared.
 */
export { classifyDomain, EMPTY_TRACKERS_INDEX, isTrackerCategory } from '@exposure/shared';
export type { TrackersIndex, DomainClassification } from '@exposure/shared';
