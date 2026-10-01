/**
 * Scoring lives in @exposure/shared (explainable score, plan §5.3).
 * The scanner feeds it the per-scan summary it aggregates.
 */
export { computeScore } from '@exposure/shared';
export type { ScoreInput } from '@exposure/shared';
