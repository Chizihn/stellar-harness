type Reply = { status?: number; headers?: Record<string, string>; body?: unknown };
export type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

export const fakeFetch = (respond: (call: Call) => Reply | Promise<Reply>) => {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    const reply = await respond(call);
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: reply.headers,
    });
  }) as typeof fetch;
  return { impl, calls };
};

export const rpcResult = (result: unknown): Reply => ({ body: { jsonrpc: '2.0', id: 1, result } });
