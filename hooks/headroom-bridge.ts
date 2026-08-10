#!/usr/bin/env -S deno run --allow-env --allow-sys --allow-net --allow-read --allow-run

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compressToolOutputs, projectFromHeaders } from './lib/headroom-bridge.ts';
import { resolveExecutable } from './lib/executable.ts';

type BridgeConfig = { upstream?: string };

type Metrics = {
  compressed: number;
  headroomCalls: number;
  lastProject?: string;
  requests: number;
  responses: number;
  skipped: number;
  tokensSaved: number;
};

const bridgePort = Number(Deno.env.get('HEADROOM_BRIDGE_PORT') || 8788);
const headroomUrl = Deno.env.get('HEADROOM_URL') || 'http://127.0.0.1:8787';
const metrics: Metrics = {
  compressed: 0,
  headroomCalls: 0,
  requests: 0,
  responses: 0,
  skipped: 0,
  tokensSaved: 0,
};
const projectsByThread = new Map<string, string>();

if (import.meta.main) {
  if (Deno.args[0] === 'ensure') {
    await ensureBridge();
  } else {
    await serve();
  }
}

async function ensureBridge() {
  if (!(await readConfig()).upstream) return;
  if (await bridgeRunning()) {
    await startHeadroom();
    await registerProject();
    return;
  }
  if (Deno.build.os === 'windows') {
    await launchWindows(
      Deno.execPath(),
      `run --quiet --allow-env --allow-sys --allow-net --allow-read --allow-run "${scriptPath()}" serve`,
    );
  } else {
    const command = [
      Deno.execPath(),
      'run',
      '--quiet',
      '--allow-env',
      '--allow-sys',
      '--allow-net',
      '--allow-read',
      '--allow-run',
      scriptPath(),
      'serve',
    ].map(shellQuote).join(' ');
    await new Deno.Command('sh', {
      args: ['-c', `setsid ${command} </dev/null >/dev/null 2>&1 &`],
      stdin: 'null',
      stdout: 'null',
      stderr: 'null',
    }).output();
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    if (await bridgeRunning()) {
      await registerProject();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function serve() {
  const config = await readConfig();
  if (!config.upstream) throw new Error('Headroom bridge has no Afterinput upstream. Re-run the installer.');
  const upstream = new URL(config.upstream);
  void startHeadroom();

  Deno.serve({ hostname: '127.0.0.1', port: bridgePort }, async (request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/session' && request.method === 'PUT') return registerSession(request);
    if (pathname === '/ready') return Response.json({ ok: true });
    if (pathname === '/health') {
      return Response.json({
        ok: true,
        pid: Deno.pid,
        headroom: await headroomRunning(),
        projects: [...new Set(projectsByThread.values())],
        ...metrics,
      });
    }

    metrics.requests++;
    const target = targetUrl(upstream, request.url);
    const responses = request.method === 'POST' && isResponsesPath(pathname);
    if (responses) {
      metrics.responses++;
      const raw = await request.text();
      const project = projectForRequest(request.headers);
      if (project) metrics.lastProject = project;
      return forward(request, target, await compressedBody(raw, project));
    }
    return forward(request, target);
  });
}

async function registerProject() {
  if (Deno.build.os !== 'windows') return;
  const threadId = cleanThreadId(Deno.env.get('CODEX_THREAD_ID'));
  const project = projectFromHeaders(
    new Headers({
      'x-headroom-cwd': Deno.cwd(),
      'x-headroom-project': Deno.env.get('HEADROOM_PROJECT') || '',
    }),
  );
  if (!threadId || !project) return;
  try {
    await fetch(`http://127.0.0.1:${bridgePort}/session`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, threadId }),
      signal: AbortSignal.timeout(500),
    });
  } catch {
    // Project analytics must not block session startup.
  }
}

async function registerSession(request: Request) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!isRecord(value)) return new Response(null, { status: 400 });
  const threadId = cleanThreadId(typeof value.threadId === 'string' ? value.threadId : null);
  const project = projectFromHeaders(
    new Headers({
      'x-headroom-project': typeof value.project === 'string' ? value.project : '',
    }),
  );
  if (!threadId || !project) return new Response(null, { status: 400 });
  projectsByThread.set(threadId, project);
  return Response.json({ ok: true, project });
}

function projectForRequest(headers: Headers) {
  const project = projectFromHeaders(headers);
  if (project) return project;
  const threadId = cleanThreadId(
    headers.get('x-headroom-thread') || headers.get('thread-id') || headers.get('session-id'),
  );
  return threadId ? projectsByThread.get(threadId) : undefined;
}

function cleanThreadId(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 128) : undefined;
}

async function compressedBody(raw: string, project?: string) {
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return raw;
    const result = await compressToolOutputs(parsed, { headroomUrl, project });
    if (result.attempted) metrics.headroomCalls++;
    if (result.compressed) {
      metrics.compressed++;
      metrics.tokensSaved += result.tokensSaved;
      return JSON.stringify(result.body);
    }
    if (result.attempted) metrics.skipped++;
  } catch {
    // Invalid JSON and Headroom failures both retain the original body.
  }
  return raw;
}

function forward(request: Request, target: URL, body?: string) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('connection');
  headers.delete('x-headroom-project');
  headers.delete('x-headroom-cwd');
  headers.delete('x-headroom-thread');
  return fetch(target, {
    method: request.method,
    headers,
    body: body ?? (request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body),
  });
}

function targetUrl(upstream: URL, requestUrl: string) {
  const incoming = new URL(requestUrl);
  const target = new URL(upstream);
  target.pathname = `${upstream.pathname.replace(/\/$/, '')}${incoming.pathname}`;
  target.search = incoming.search;
  return target;
}

function isResponsesPath(pathname: string) {
  return pathname === '/responses' || pathname === '/v1/responses';
}

async function bridgeRunning() {
  try {
    const endpoint = Deno.build.os === 'windows' ? 'ready' : 'health';
    return (await fetch(`http://127.0.0.1:${bridgePort}/${endpoint}`, { signal: AbortSignal.timeout(200) })).ok;
  } catch {
    return false;
  }
}

async function headroomRunning() {
  try {
    return (await fetch(`${headroomUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(1_500) })).ok;
  } catch {
    return false;
  }
}

async function startHeadroom() {
  if (Deno.env.get('HEADROOM_BRIDGE_START_HEADROOM') === 'false' || await headroomRunning()) return;
  const port = new URL(headroomUrl).port || '8787';
  try {
    if (Deno.build.os === 'windows') {
      await launchWindows(resolveExecutable('headroom'), `proxy --port ${port}`);
      return;
    }
    const child = new Deno.Command(resolveExecutable('headroom'), {
      args: ['proxy', '--port', port],
      stdin: 'null',
      stdout: 'null',
      stderr: 'null',
    }).spawn();
    child.unref();
  } catch {
    // The bridge still forwards directly when Headroom is unavailable.
  }
}

async function launchWindows(executable: string, argumentsValue: string) {
  const launch = await new Deno.Command(resolveExecutable('powershell'), {
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Start-Process -FilePath $env:CODEX_HOOK_EXECUTABLE -ArgumentList $env:CODEX_HOOK_ARGUMENTS -WindowStyle Hidden',
    ],
    env: {
      CODEX_HOOK_ARGUMENTS: argumentsValue,
      CODEX_HOOK_EXECUTABLE: executable,
    },
    stdin: 'null',
    stdout: 'null',
    stderr: 'piped',
  }).output();
  if (!launch.success) {
    throw new Error(new TextDecoder().decode(launch.stderr).trim() || `Failed to launch ${executable}`);
  }
}

async function readConfig(): Promise<BridgeConfig> {
  const codexHome = Deno.env.get('CODEX_HOME') || path.join(os.homedir(), '.codex');
  try {
    return JSON.parse(await Deno.readTextFile(path.join(codexHome, '.codex-hook', 'headroom-bridge.json')));
  } catch {
    return {};
  }
}

function scriptPath() {
  return fileURLToPath(import.meta.url);
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
