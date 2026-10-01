/**
 * Request logging via Workers console (visible in `wrangler tail`).
 * Wired into the fetch handler in Phase 5.
 */
export function logRequest(method: string, path: string, status: number, ms: number): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), method, path, status, ms }));
}
