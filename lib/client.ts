export class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error || 'Something went wrong. Try again.', response.status);
  return data as T;
}

export function jsonRequest<T>(url: string, method: string, data?: unknown) {
  return request<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}

export function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The current cart still works in memory. */ }
}
