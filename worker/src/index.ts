/**
 * Exposure live-scan API.
 *
 * Phase 0: the fetch-handler shape only — routing, D1 caching, quota and the
 * Browser Run scan itself land in Phase 5 per docs/IMPLEMENTATION-PLAN.md.
 */

export interface Env {
  /** Bindings are declared here as they are added (Phase 5): */
  // DB: D1Database;
  // BUCKET: R2Bucket;
  // BROWSER: Browser;
  // INGEST_SECRET: string;
  readonly _placeholder?: never;
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({ service: 'exposure-api', status: 'phase-0-skeleton' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }
};
