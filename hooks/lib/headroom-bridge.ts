type JsonRecord = Record<string, unknown>;

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type CompressionOptions = {
  fetch?: FetchFunction;
  headroomUrl: string;
  project?: string;
  timeoutMs?: number;
};

type CompressionResult = {
  body: JsonRecord;
  attempted: boolean;
  compressed: boolean;
  tokensSaved: number;
};

type TextBlock = JsonRecord & { text: string; type: 'input_text' | 'text' };

type ToolOutput = {
  callId: string;
  firstBlock?: TextBlock;
  item: JsonRecord;
  text: string;
};

const TOOL_OUTPUT_TYPES = new Set(['function_call_output', 'custom_tool_call_output']);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextBlock(value: unknown): value is TextBlock {
  return isRecord(value) && (value.type === 'input_text' || value.type === 'text') && typeof value.text === 'string';
}

function endpointFor(headroomUrl: string, project?: string) {
  const endpoint = new URL(headroomUrl);
  const projectPrefix = project ? `/p/${encodeURIComponent(project)}` : '';
  endpoint.pathname = `${projectPrefix}${endpoint.pathname.replace(/\/$/, '')}/v1/compress`;
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint;
}

function cleanProject(value: string | null) {
  if (!value) return undefined;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep malformed percent escapes literal; Headroom also sanitizes them.
  }
  // deno-lint-ignore no-control-regex
  const cleaned = decoded.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  return cleaned ? cleaned.slice(0, 128) : undefined;
}

function projectFromHeaders(headers: Headers) {
  const explicit = cleanProject(headers.get('x-headroom-project'));
  if (explicit) return explicit;
  const cwd = cleanProject(headers.get('x-headroom-cwd'))?.replace(/[\\/]+$/, '');
  return cwd ? cleanProject(cwd.split(/[\\/]/).at(-1) ?? null) : undefined;
}

function toolOutputs(body: JsonRecord): ToolOutput[] {
  if (!Array.isArray(body.input)) return [];
  const outputs: ToolOutput[] = [];
  for (const item of body.input) {
    if (
      !isRecord(item) || typeof item.type !== 'string' || !TOOL_OUTPUT_TYPES.has(item.type) ||
      typeof item.call_id !== 'string'
    ) continue;

    if (typeof item.output === 'string') {
      outputs.push({ callId: item.call_id, item, text: item.output });
      continue;
    }
    if (Array.isArray(item.output) && item.output.length && item.output.every(isTextBlock)) {
      outputs.push({
        callId: item.call_id,
        firstBlock: item.output[0],
        item,
        text: item.output.map((block) => block.text).join('\n'),
      });
    }
  }
  return outputs;
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
  { fetch: fetchFn = fetch, headroomUrl, project, timeoutMs = 15_000 }: CompressionOptions,
): Promise<CompressionResult> {
  if (typeof body.model !== 'string') return { body, attempted: false, compressed: false, tokensSaved: 0 };

  const rewritten = structuredClone(body);
  const outputs = toolOutputs(rewritten);
  if (!outputs.length) return { body, attempted: false, compressed: false, tokensSaved: 0 };

  let response: Response;
  try {
    response = await fetchFn(endpointFor(headroomUrl, project), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client': 'codex' },
      body: JSON.stringify({
        model: rewritten.model,
        config: { mode: 'lossy_inline' },
        messages: outputs.map((item) => ({
          role: 'tool',
          tool_call_id: item.callId,
          content: item.text,
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

  const before = outputs.reduce((total, item) => total + item.text.length, 0);
  const after = contents.reduce((total, content) => total + (content as string).length, 0);
  if (after >= before) return { body, attempted: true, compressed: false, tokensSaved: 0 };

  outputs.forEach((item, index) => {
    item.item.output = item.firstBlock ? [{ ...item.firstBlock, text: contents[index]! }] : contents[index]!;
  });
  return {
    body: rewritten,
    attempted: true,
    compressed: true,
    tokensSaved: typeof result.tokens_saved === 'number' ? result.tokens_saved : 0,
  };
}

export { compressToolOutputs, projectFromHeaders };
