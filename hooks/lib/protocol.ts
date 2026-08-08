type HookEvent = {
  hook_event_name?: string;
  tool_input?: { command?: unknown };
};

const encoder = new TextEncoder();

function output(value: unknown) {
  Deno.stdout.writeSync(encoder.encode(JSON.stringify(value)));
}

async function readEvent(callback: (event: HookEvent) => void) {
  try {
    const input = await new Response(Deno.stdin.readable).text();
    callback(JSON.parse(input.replace(/^\uFEFF/, '')) as HookEvent);
  } catch {
    Deno.exit(0);
  }
}

export { output, readEvent };
export type { HookEvent };
