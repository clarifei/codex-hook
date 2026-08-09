type JsonRecord = Record<string, unknown>;

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type CompressionOptions = {
  fetch?: FetchFunction;
  headroomUrl: string;
  timeoutMs?: number;
};

type CompressionResult = {
  body: JsonRecord;
  attempted: boolean;
  compressed: boolean;
  tokensSaved: number;
};

const TOOL_OUTPUT_TYPES = new Set(['function_call_output', 'custom_tool_call_output']);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function endpointFor(headroomUrl: string) {
  const endpoint = new URL(headroomUrl);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/v1/compress`;
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint;
}

function toolOutputs(body: JsonRecord) {
  if (!Array.isArray(body.input)) return [];
  return body.input.filter((item): item is JsonRecord =>
    isRecord(item) &&
    typeof item.type === 'string' &&
    TOOL_OUTPUT_TYPES.has(item.type) &&
    typeof item.output === 'string' &&
    typeof item.call_id === 'string'
  );
}

function compressedContent(value: unknown) {
  return isRecord(value) && value.role === 'tool' && typeof value.content === 'string' ? value.content : null;
}

/**
 * Compress only Responses tool outputs. Other item types carry continuity data
 * that must reach an OAuth-backed upstream exactly as Codex produced it.
 */
async function compressToolOutputs(
  body: JsonRecord,
  { fetch: fetchFn = fetch, headroomUrl, timeoutMs = 15_000 }: CompressionOptions,
): Promise<CompressionResult> {
  if (typeof body.model !== 'string') return { body, attempted: false, compressed: false, tokensSaved: 0 };

  const rewritten = structuredClone(body);
  const outputs = toolOutputs(rewritten);
  if (!outputs.length) return { body, attempted: false, compressed: false, tokensSaved: 0 };

  let response: Response;
  try {
    response = await fetchFn(endpointFor(headroomUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client': 'codex' },
      body: JSON.stringify({
        model: rewritten.model,
        config: { mode: 'lossy_inline' },
        messages: outputs.map((item) => ({
          role: 'tool',
          tool_call_id: item.call_id,
          content: item.output,
        })),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { body, attempted: true, compressed: false, tokensSaved: 0 };
  }

  if (!response.ok) return { body, attempted: true, compressed: false, tokensSaved: 0 };

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    return { body, attempted: true, compressed: false, tokensSaved: 0 };
  }
  if (!isRecord(result) || !Array.isArray(result.messages) || result.messages.length !== outputs.length) {
    return { body, attempted: true, compressed: false, tokensSaved: 0 };
  }

  const contents = result.messages.map(compressedContent);
  if (contents.some((content) => content === null)) {
    return { body, attempted: true, compressed: false, tokensSaved: 0 };
  }

  const before = outputs.reduce((total, item) => total + (item.output as string).length, 0);
  const after = contents.reduce((total, content) => total + (content as string).length, 0);
  if (after >= before) return { body, attempted: true, compressed: false, tokensSaved: 0 };

  outputs.forEach((item, index) => {
    item.output = contents[index]!;
  });
  return {
    body: rewritten,
    attempted: true,
    compressed: true,
    tokensSaved: typeof result.tokens_saved === 'number' ? result.tokens_saved : 0,
  };
}

export { compressToolOutputs };
