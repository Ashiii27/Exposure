/**
 * Worker-local types. Route handlers and bindings types land in Phase 5;
 * the ScanResult contract comes from @exposure/shared.
 */
export type { ScanResult } from '@exposure/shared';

/** Request-shape types shared by the route modules (Phase 5 fills these in). */
export interface RoutePlaceholder {
  path: string;
}
