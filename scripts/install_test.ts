import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  disableHeadroomBridge,
  ensureCodebaseMemory,
  ensureHeadroomBridge,
  ensureMcpServer,
  ensureWigolo,
  headroomBridgeEnabled,
} from './lib/config.ts';
import { compressToolOutputs, projectFromHeaders } from '../hooks/lib/headroom-bridge.ts';
import { resolveExecutable } from '../hooks/lib/executable.ts';
import { gitBlobHash, installBytes, sameBlobHash } from './lib/files.ts';
import {
  discoverSkills,
  optionalSkillGroups,
  optionalSkills,
  setOptionalSkillGroups,
  skillsFor,
} from './skill-manifest.ts';
import { installedSelection, parseArgs } from './selection.ts';
import { pruneManaged, readState, reserve, syncSkills, targetFor, uninstallSkills, writeState } from './sync-skills.ts';
import { testOptionalSkillGroups } from './test-manifest.ts';

setOptionalSkillGroups(testOptionalSkillGroups);

Deno.test('manifest and CLI selection', () => {
  const mattPocock = optionalSkillGroups.find(({ id }) => id === 'matt-pocock')!;
  assert.deepEqual(mattPocock.skills.map(({ id }) => id), [
    'matt-pocock-engineering',
    'matt-pocock-productivity',
  ]);
  assert(optionalSkills.every(({ sources }) => sources.length === 1));

  const baseline = skillsFor().map((skill) => `${skill.repository}:${skill.source}`).sort();
  assert.deepEqual(baseline, [
    'DietrichGebert/ponytail:skills',
    'JuliusBrussee/caveman:skills',
    'KnockOutEZ/wigolo:skills',
  ]);

  const all = skillsFor('beeline', optionalSkillGroups.map(({ id }) => id));
  assert.equal(all.length, 3 + optionalSkills.length);
  assert(all.some((skill) => skill.repository === 'denoland/skills' && skill.source === 'skills/deno'));
  assert(
    all.some((skill) =>
      skill.repository === 'tanstack-skills/tanstack-skills' && skill.destination === 'tanstack/query'
    ),
  );
  const optionalSources = optionalSkills.flatMap(({ sources }) => sources);
  for (const group of optionalSkillGroups) {
    for (const skill of group.skills) {
      const selected = skillsFor('beeline', [skill.id], false)
        .filter((source) => optionalSources.includes(source));
      assert.deepEqual(selected, [...skill.sources], `${group.id}/${skill.id} selected siblings`);
    }
  }
  assert.deepEqual(parseArgs(['--style', 'baseline', '--with', 'matt-pocock']), {
    interactive: false,
    style: 'caveman',
    optional: ['matt-pocock-engineering', 'matt-pocock-productivity'],
  });
  assert.deepEqual(parseArgs(['--with', 'deno']).optional, [
    'deno',
    'deno-deploy',
  ]);
  assert.deepEqual(parseArgs(['--with', 'tanstack-query']).optional, ['tanstack-query']);
  assert.deepEqual(parseArgs(['--uninstall', 'tanstack-query']).uninstall, ['tanstack-query']);
  assert.equal(parseArgs(['--refresh', '--yes']).refresh, true);
  assert.equal(parseArgs(['--headroom', '--yes']).headroom, true);
  assert.equal(parseArgs(['--no-headroom', '--yes']).headroom, false);
});

Deno.test('resolves Windows executables after a malformed quoted PATH entry', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  const executable = path.join(directory, 'cargo.exe');
  try {
    Deno.writeFileSync(executable, new Uint8Array());
    assert.equal(
      resolveExecutable('cargo', {
        env: {
          Path: `C:\\broken\";\"${directory}\"`,
          PATHEXT: '.exe;.cmd',
        },
        os: 'windows',
      }),
      executable,
    );
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('leaves command lookup unchanged outside Windows', () => {
  assert.equal(resolveExecutable('cargo', { env: {}, os: 'linux' }), 'cargo');
});

Deno.test('discovers new child skills without merging collections', () => {
  const skills = discoverSkills({
    id: 'deno',
    label: 'Deno',
    repository: 'denoland/skills',
    ref: 'main',
  }, [
    { path: 'skills/deno/SKILL.md', sha: 'deno', type: 'blob' },
    { path: 'skills/new-runtime/SKILL.md', sha: 'new', type: 'blob' },
    { path: 'skills/new-runtime/README.md', sha: 'readme', type: 'blob' },
  ]);
  const added = skills.find(({ id }) => id === 'new-runtime');
  assert(added);
  assert.equal(added.sources[0].destination, 'deno/new-runtime');
  assert.equal(skills.find(({ id }) => id === 'deno')?.sources[0].source, 'skills/deno');
});

Deno.test('infers nested collections and root skills', () => {
  const matt = discoverSkills({
    id: 'matt-pocock',
    label: 'Matt Pocock',
    repository: 'mattpocock/skills',
    ref: 'main',
  }, [
    { path: 'skills/engineering/review/SKILL.md', sha: 'engineering', type: 'blob' },
    { path: 'skills/productivity/planning/SKILL.md', sha: 'productivity', type: 'blob' },
  ]);
  assert.deepEqual(
    matt.map(({ id, sources }) => [id, sources[0].source, sources[0].destination]),
    [
      ['matt-pocock-engineering', 'skills/engineering', 'matt-pocock/engineering'],
      ['matt-pocock-productivity', 'skills/productivity', 'matt-pocock/productivity'],
    ],
  );

  const root = discoverSkills({
    id: 'hono',
    label: 'Hono',
    repository: 'yusukebe/hono-skill',
    ref: 'main',
  }, [{ path: 'SKILL.md', sha: 'hono', type: 'blob' }]);
  assert.deepEqual(root[0]?.sources[0], {
    repository: 'yusukebe/hono-skill',
    ref: 'main',
    source: '',
    destination: 'hono',
    exclude: ['README.md'],
  });

  const emil = discoverSkills({
    id: 'emil-kowalski',
    label: 'Emil Kowalski',
    repository: 'emilkowalski/skills',
    ref: 'main',
    excluded: ['skills/prototype'],
  }, [
    { path: 'skills/animate/SKILL.md', sha: 'animate', type: 'blob' },
    { path: 'skills/prototype/SKILL.md', sha: 'prototype', type: 'blob' },
  ]);
  assert.deepEqual(emil.map(({ id }) => id), ['animate']);
});

Deno.test('detects destination skills installed locally', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  try {
    installBytes(targetFor(directory, 'tanstack/query/SKILL.md'), new TextEncoder().encode('skill'));
    assert.deepEqual(installedSelection(directory), ['tanstack-query']);
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('uses the local cache and uninstalls owned files offline', async () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  try {
    const relative = 'tanstack/query/SKILL.md';
    const target = targetFor(directory, relative);
    const bytes = new TextEncoder().encode('cached skill');
    installBytes(target, bytes);
    writeState(path.join(directory, '.codex-hook', 'skills.json'), {
      version: 4,
      style: 'caveman',
      optional: ['tanstack-query'],
      files: { [relative]: gitBlobHash(bytes) },
      skillFiles: { 'tanstack-query': [relative] },
    });

    assert.deepEqual(await syncSkills(directory, { style: 'caveman', optional: ['tanstack-query'] }), [
      { action: 'skip', target },
    ]);
    assert.deepEqual(
      (await uninstallSkills(directory, ['tanstack-query'])).map(({ action }) => action),
      ['remove'],
    );
    assert.throws(() => Deno.statSync(target));
    assert.deepEqual(readState(path.join(directory, '.codex-hook', 'skills.json')).optional, []);
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('managed paths reject collisions and escapes', () => {
  assert.throws(() => reserve(new Set(['duplicate']), 'duplicate'), /^Error: duplicate skill target:/);
  assert.throws(() => targetFor('/tmp/codex-hook-test', '../escape'), /^Error: invalid skill target:/);
});

Deno.test('recognizes GitHub and jsDelivr file hashes', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  try {
    const bytes = new TextEncoder().encode('skill');
    const target = targetFor(directory, 'hash/SKILL.md');
    installBytes(target, bytes);
    assert(sameBlobHash(target, gitBlobHash(bytes)));
    assert(sameBlobHash(target, crypto.createHash('sha256').update(bytes).digest('base64')));
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('managed files and MCP config are idempotent', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  try {
    const managedRelative = 'optional/SKILL.md';
    const managedTarget = targetFor(directory, managedRelative);
    installBytes(managedTarget, new TextEncoder().encode('user edit'));
    assert.equal(
      pruneManaged(directory, { [managedRelative]: 'upstream hash' }, {})[0]?.action,
      'preserve',
    );

    const statePath = path.join(directory, '.codex-hook', 'skills.json');
    writeState(statePath, { version: 1, style: 'caveman', optional: [], files: {} });
    assert.equal(readState(statePath).style, 'caveman');

    const configPath = path.join(directory, 'config.toml');
    assert(ensureCodebaseMemory(configPath));
    assert(!ensureCodebaseMemory(configPath));
    assert(ensureWigolo(configPath));
    assert(!ensureWigolo(configPath));

    Deno.writeTextFileSync(
      configPath,
      `model_provider = "custom"

[model_providers.custom]
base_url = "https://pool.afterinput.com"
`,
    );
    assert(ensureHeadroomBridge(configPath));
    assert.equal(ensureHeadroomBridge(configPath), false);
    assert(headroomBridgeEnabled(configPath));
    assert.match(Deno.readTextFileSync(configPath), /base_url = "http:\/\/127\.0\.0\.1:8788"/);
    assert.deepEqual(
      JSON.parse(Deno.readTextFileSync(path.join(directory, '.codex-hook', 'headroom-bridge.json'))),
      { upstream: 'https://pool.afterinput.com' },
    );
    assert.match(Deno.readTextFileSync(configPath), /"X-Headroom-Cwd" = "PWD"/);
    assert.match(Deno.readTextFileSync(configPath), /"X-Headroom-Thread" = "CODEX_THREAD_ID"/);
    assert(disableHeadroomBridge(configPath));
    assert(!headroomBridgeEnabled(configPath));
    assert.match(Deno.readTextFileSync(configPath), /base_url = "https:\/\/pool\.afterinput\.com"/);
    assert.doesNotMatch(Deno.readTextFileSync(configPath), /X-Headroom/);
    assert(!disableHeadroomBridge(configPath));
    Deno.writeTextFileSync(
      configPath,
      Deno.readTextFileSync(configPath).replace('https://pool.afterinput.com', 'ftp://pool.afterinput.com'),
    );
    assert(!ensureHeadroomBridge(configPath));
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('adds MCP startup budget only on Windows', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  try {
    const windowsConfig = path.join(directory, 'windows.toml');
    Deno.writeTextFileSync(
      windowsConfig,
      `[mcp_servers.codebase-memory-mcp]
command = "custom-code-memory"
args = ["serve"]
`,
    );
    assert(ensureMcpServer(
      windowsConfig,
      'codebase-memory-mcp',
      'npx',
      ['-y', 'codebase-memory-mcp'],
      true,
      'windows',
    ));
    assert(
      !ensureMcpServer(
        windowsConfig,
        'codebase-memory-mcp',
        'npx',
        ['-y', 'codebase-memory-mcp'],
        true,
        'windows',
      ),
    );
    assert.match(Deno.readTextFileSync(windowsConfig), /command = "custom-code-memory"/);
    assert.match(Deno.readTextFileSync(windowsConfig), /^startup_timeout_sec = 120$/m);

    const linuxConfig = path.join(directory, 'linux.toml');
    assert(ensureMcpServer(linuxConfig, 'wigolo', 'npx', ['-y', 'wigolo'], false, 'linux'));
    assert.doesNotMatch(Deno.readTextFileSync(linuxConfig), /startup_timeout_sec/);
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('Headroom setup preserves existing provider header mappings', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  const configPath = path.join(directory, 'config.toml');
  try {
    Deno.writeTextFileSync(
      configPath,
      `model_provider = "custom"

[model_providers.custom]
base_url = "https://pool.afterinput.com"
env_http_headers = { "X-Custom" = "CUSTOM_TOKEN" }
`,
    );
    assert(ensureHeadroomBridge(configPath));
    assert.equal(Deno.readTextFileSync(configPath).match(/^env_http_headers\s*=/gm)?.length, 1);
    assert.match(Deno.readTextFileSync(configPath), /"X-Custom" = "CUSTOM_TOKEN"/);
    assert(disableHeadroomBridge(configPath));
    assert.match(Deno.readTextFileSync(configPath), /"X-Custom" = "CUSTOM_TOKEN"/);
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('Headroom setup upgrades its managed project header', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  const configPath = path.join(directory, 'config.toml');
  try {
    Deno.writeTextFileSync(
      configPath,
      `model_provider = "custom"

[model_providers.custom]
base_url = "https://pool.afterinput.com"
# codex-hook: Headroom project analytics
env_http_headers = { "X-Headroom-Project" = "HEADROOM_PROJECT", "X-Headroom-Cwd" = "PWD" }
`,
    );
    assert(ensureHeadroomBridge(configPath));
    assert.match(Deno.readTextFileSync(configPath), /"X-Headroom-Thread" = "CODEX_THREAD_ID"/);
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test({
  name: 'Headroom ensure launches a detached bridge on Windows',
  ignore: Deno.build.os !== 'windows',
  async fn() {
    const listener = Deno.listen({ hostname: '127.0.0.1', port: 0 });
    const bridgePort = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const directory = Deno.makeTempDirSync({ prefix: 'codex-headroom-windows-' });
    const codexHome = path.join(directory, '.codex');
    let bridgePid = 0;
    Deno.mkdirSync(path.join(codexHome, '.codex-hook'), { recursive: true });
    Deno.writeTextFileSync(
      path.join(codexHome, '.codex-hook', 'headroom-bridge.json'),
      JSON.stringify({ upstream: 'https://pool.afterinput.com' }),
    );
    try {
      const started = performance.now();
      const result = await new Deno.Command(Deno.execPath(), {
        args: [
          'run',
          '--quiet',
          '--allow-env',
          '--allow-sys',
          '--allow-net',
          '--allow-read',
          '--allow-run',
          path.join(Deno.cwd(), 'hooks', 'headroom-bridge.ts'),
          'ensure',
        ],
        env: {
          CODEX_HOME: '',
          CODEX_THREAD_ID: 'thread-1',
          HEADROOM_BRIDGE_PORT: String(bridgePort),
          HEADROOM_BRIDGE_START_HEADROOM: 'false',
          HOME: directory,
          USERPROFILE: directory,
        },
        stdin: 'null',
        stdout: 'piped',
        stderr: 'piped',
      }).output();
      const startupMs = performance.now() - started;
      assert(result.success, new TextDecoder().decode(result.stderr));
      const response = await fetch(`http://127.0.0.1:${bridgePort}/health`);
      assert(response.ok);
      const health = await response.json();
      bridgePid = Number(health.pid);
      assert(bridgePid > 0);
      assert.deepEqual(health.projects, [path.basename(Deno.cwd())]);
      assert(startupMs < 5_000, `Headroom ensure took ${Math.round(startupMs)}ms`);
    } finally {
      if (bridgePid) Deno.kill(bridgePid, 'SIGTERM');
      Deno.removeSync(directory, { recursive: true });
    }
  },
});

Deno.test('compresses only Responses tool outputs and fails open', async () => {
  const body = {
    model: 'gpt-5.6-terra',
    input: [
      { type: 'reasoning', encrypted_content: 'keep' },
      { type: 'function_call', call_id: 'call_1', name: 'shell', arguments: '{}' },
      { type: 'function_call_output', call_id: 'call_1', output: 'very long tool output' },
      {
        type: 'custom_tool_call_output',
        call_id: 'call_2',
        output: [{ type: 'input_text', text: 'first block' }, { type: 'text', text: 'second block' }],
      },
      {
        type: 'custom_tool_call_output',
        call_id: 'call_3',
        output: [{ type: 'input_text', text: 'keep text' }, { type: 'input_image', image_url: 'keep-image' }],
      },
    ],
  };
  const result = await compressToolOutputs(body, {
    headroomUrl: 'http://127.0.0.1:8787',
    project: 'codex-hook',
    fetch: (input, init) => {
      assert.equal(new URL(String(input)).pathname, '/p/codex-hook/v1/compress');
      assert.deepEqual(Object.fromEntries(new Headers(init?.headers)), {
        'content-type': 'application/json',
        'x-client': 'codex',
      });
      assert.deepEqual(JSON.parse(String(init?.body)), {
        config: { mode: 'lossy_inline' },
        model: 'gpt-5.6-terra',
        messages: [
          { role: 'tool', tool_call_id: 'call_1', content: 'very long tool output' },
          { role: 'tool', tool_call_id: 'call_2', content: 'first block\nsecond block' },
        ],
      });
      return Promise.resolve(
        Response.json({
          messages: [{ role: 'tool', content: 'short output' }, { role: 'tool', content: 'short blocks' }],
          tokens_saved: 12,
        }),
      );
    },
  });
  assert(result.attempted);
  assert(result.compressed);
  assert.equal(result.tokensSaved, 12);
  assert.equal((result.body.input as Array<Record<string, unknown>>)[2]?.output, 'short output');
  assert.deepEqual((result.body.input as Array<Record<string, unknown>>)[3]?.output, [
    { type: 'input_text', text: 'short blocks' },
  ]);
  assert.deepEqual((result.body.input as Array<Record<string, unknown>>)[4]?.output, body.input[4].output);
  assert.equal((result.body.input as Array<Record<string, unknown>>)[0]?.encrypted_content, 'keep');
  assert.equal((body.input[2] as Record<string, unknown>).output, 'very long tool output');
  assert.deepEqual(body.input[3].output, [
    { type: 'input_text', text: 'first block' },
    { type: 'text', text: 'second block' },
  ]);

  const fallback = await compressToolOutputs(body, {
    headroomUrl: 'http://127.0.0.1:8787',
    fetch: () => Promise.resolve(new Response(null, { status: 503 })),
  });
  assert(fallback.attempted);
  assert.equal(fallback.compressed, false);
  assert.equal(fallback.body, body);
});

Deno.test('derives Headroom project from explicit override or working directory', () => {
  assert.equal(
    projectFromHeaders(new Headers({ 'x-headroom-project': 'named%20project', 'x-headroom-cwd': '/tmp/ignored' })),
    'named project',
  );
  assert.equal(projectFromHeaders(new Headers({ 'x-headroom-cwd': '/work/codex-hook/' })), 'codex-hook');
  assert.equal(projectFromHeaders(new Headers({ 'x-headroom-cwd': String.raw`C:\work\codex-hook` })), 'codex-hook');
});

Deno.test('bridge sends OAuth only to Afterinput', async () => {
  const headroomPort = 18877;
  const bridgePort = 18878;
  const upstreamPort = 18879;
  let compressorAuth: string | null = null;
  let compressorClient: string | null = null;
  let compressorPath: string | null = null;
  let upstreamAuth: string | null = null;
  let upstreamCwd: string | null = null;
  let upstreamProject: string | null = null;
  let upstreamThread: string | null = null;
  let upstreamBody: Record<string, unknown> | undefined;
  const headroom = Deno.serve({ hostname: '127.0.0.1', port: headroomPort }, async (request) => {
    if (new URL(request.url).pathname === '/health') return Response.json({ ok: true });
    compressorPath = new URL(request.url).pathname;
    compressorAuth = request.headers.get('authorization');
    compressorClient = request.headers.get('x-client');
    const body = await request.json();
    assert.deepEqual(body, {
      config: { mode: 'lossy_inline' },
      model: 'gpt-5.6-terra',
      messages: [{ role: 'tool', tool_call_id: 'call_1', content: 'long output\nsecond block' }],
    });
    return Response.json({ messages: [{ role: 'tool', content: 'short' }], tokens_saved: 3 });
  });
  const upstream = Deno.serve({ hostname: '127.0.0.1', port: upstreamPort }, async (request) => {
    upstreamAuth = request.headers.get('authorization');
    upstreamCwd = request.headers.get('x-headroom-cwd');
    upstreamProject = request.headers.get('x-headroom-project');
    upstreamThread = request.headers.get('x-headroom-thread');
    upstreamBody = await request.json();
    return Response.json({ ok: true });
  });
  const codexHome = Deno.makeTempDirSync({ prefix: 'codex-headroom-' });
  Deno.mkdirSync(path.join(codexHome, '.codex-hook'));
  Deno.writeTextFileSync(
    path.join(codexHome, '.codex-hook', 'headroom-bridge.json'),
    JSON.stringify({ upstream: `http://127.0.0.1:${upstreamPort}` }),
  );
  const bridge = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '--quiet',
      '--allow-env',
      '--allow-net',
      '--allow-read',
      '--allow-run',
      path.join(Deno.cwd(), 'hooks', 'headroom-bridge.ts'),
    ],
    env: {
      CODEX_HOME: codexHome,
      HEADROOM_BRIDGE_PORT: String(bridgePort),
      HEADROOM_URL: `http://127.0.0.1:${headroomPort}`,
      HEADROOM_BRIDGE_START_HEADROOM: 'false',
    },
    stdin: 'null',
    stdout: 'null',
    stderr: 'null',
  }).spawn();

  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        if ((await fetch(`http://127.0.0.1:${bridgePort}/health`)).ok) break;
      } catch {
        // The child has not bound the port yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const registration = await fetch(`http://127.0.0.1:${bridgePort}/session`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: 'codex-hook', threadId: 'thread-1' }),
    });
    assert(registration.ok);
    const response = await fetch(`http://127.0.0.1:${bridgePort}/responses`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer opaque-oauth-token',
        'content-type': 'application/json',
        'x-headroom-thread': 'thread-1',
      },
      body: JSON.stringify({
        model: 'gpt-5.6-terra',
        input: [{
          type: 'custom_tool_call_output',
          call_id: 'call_1',
          output: [{ type: 'input_text', text: 'long output' }, { type: 'input_text', text: 'second block' }],
        }],
      }),
    });
    assert(response.ok);
    assert.equal(compressorAuth, null);
    assert.equal(compressorClient, 'codex');
    assert.equal(compressorPath, '/p/codex-hook/v1/compress');
    assert.equal(upstreamAuth, 'Bearer opaque-oauth-token');
    assert.equal(upstreamCwd, null);
    assert.equal(upstreamProject, null);
    assert.equal(upstreamThread, null);
    assert.deepEqual((upstreamBody?.input as Array<Record<string, unknown>>)[0]?.output, [
      { type: 'input_text', text: 'short' },
    ]);
    assert.deepEqual(await (await fetch(`http://127.0.0.1:${bridgePort}/health`)).json(), {
      ok: true,
      pid: bridge.pid,
      headroom: true,
      projects: ['codex-hook'],
      lastProject: 'codex-hook',
      compressed: 1,
      headroomCalls: 1,
      requests: 1,
      responses: 1,
      skipped: 0,
      tokensSaved: 3,
    });
  } finally {
    bridge.kill('SIGTERM');
    await bridge.status;
    await headroom.shutdown();
    await upstream.shutdown();
    Deno.removeSync(codexHome, { recursive: true });
  }
});
