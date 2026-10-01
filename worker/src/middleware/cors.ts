/**
 * CORS for the public scan API. Wired into the fetch handler in Phase 5 —
 * Workers middleware is a plain function (Request, Env) => Response, not
 * Express-style (req, res, next).
 */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
