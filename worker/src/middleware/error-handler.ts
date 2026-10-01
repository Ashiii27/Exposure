/**
 * Uniform JSON error responses. Wired into the fetch handler in Phase 5.
 */
export interface ApiErrorBody {
  error: string;
  detail?: string;
}

export function errorResponse(status: number, error: string, detail?: string): Response {
  const body: ApiErrorBody = detail === undefined ? { error } : { error, detail };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
