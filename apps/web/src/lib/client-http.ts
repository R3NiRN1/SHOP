export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? 'The request failed. Please refresh and try again.');
  return body as T;
}
export const postJson = <T,>(url: string, body: unknown) => fetchJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const messageOf = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';
