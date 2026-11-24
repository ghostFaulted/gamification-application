import { vi } from 'vitest';

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export type ApiHandler = () => Response | Promise<Response>;

/** Answers fetch by "METHOD url"; each handler list is used in order, the last one repeats. */
export function mockApi(routes: Record<string, ApiHandler[]>) {
  const used: Record<string, number> = {};
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handlers = routes[key];
    if (!handlers) throw new Error(`Unexpected request ${key}`);
    const index = Math.min(used[key] ?? 0, handlers.length - 1);
    used[key] = (used[key] ?? 0) + 1;
    return handlers[index]();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
