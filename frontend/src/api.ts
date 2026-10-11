export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  } catch { throw new Error('Could not reach RideCircle. Check that the local backend is running.'); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: { loc: string[]; msg: string }) => `${e.loc.slice(1).join(' ')}: ${e.msg}`).join('; ') : `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}
export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
