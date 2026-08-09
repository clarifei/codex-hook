import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  disableHeadroomBridge,
  ensureCodebaseMemory,
  ensureHeadroomBridge,
  ensureWigolo,
  headroomBridgeEnabled,
} from './lib/config.ts';
import { compressToolOutputs } from '../hooks/lib/headroom-bridge.ts';
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
    assert(disableHeadroomBridge(configPath));
    assert(!headroomBridgeEnabled(configPath));
    assert.match(Deno.readTextFileSync(configPath), /base_url = "https:\/\/pool\.afterinput\.com"/);
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

Deno.test('compresses only Responses tool outputs and fails open', async () => {
  const body = {
    model: 'gpt-5.6-terra',
    input: [
      { type: 'reasoning', encrypted_content: 'keep' },
      { type: 'function_call', call_id: 'call_1', name: 'shell', arguments: '{}' },
      { type: 'function_call_output', call_id: 'call_1', output: 'very long tool output' },
    ],
  };
  const result = await compressToolOutputs(body, {
    headroomUrl: 'http://127.0.0.1:8787',
    fetch: (_input, init) => {
      assert.deepEqual(Object.fromEntries(new Headers(init?.headers)), {
        'content-type': 'application/json',
        'x-client': 'codex',
      });
      assert.deepEqual(JSON.parse(String(init?.body)), {
        config: { mode: 'lossy_inline' },
        model: 'gpt-5.6-terra',
        messages: [{ role: 'tool', tool_call_id: 'call_1', content: 'very long tool output' }],
      });
      return Promise.resolve(
        Response.json({ messages: [{ role: 'tool', content: 'short output' }], tokens_saved: 12 }),
      );
    },
  });
  assert(result.attempted);
  assert(result.compressed);
  assert.equal(result.tokensSaved, 12);
  assert.equal((result.body.input as Array<Record<string, unknown>>)[2]?.output, 'short output');
  assert.equal((result.body.input as Array<Record<string, unknown>>)[0]?.encrypted_content, 'keep');
  assert.equal((body.input[2] as Record<string, unknown>).output, 'very long tool output');

  const fallback = await compressToolOutputs(body, {
    headroomUrl: 'http://127.0.0.1:8787',
    fetch: () => Promise.resolve(new Response(null, { status: 503 })),
  });
  assert(fallback.attempted);
  assert.equal(fallback.compressed, false);
  assert.equal(fallback.body, body);
});

Deno.test('bridge sends OAuth only to Afterinput', async () => {
  const headroomPort = 18877;
  const bridgePort = 18878;
  const upstreamPort = 18879;
  let compressorAuth: string | null = null;
  let compressorClient: string | null = null;
  let upstreamAuth: string | null = null;
  let upstreamBody: Record<string, unknown> | undefined;
  const headroom = Deno.serve({ hostname: '127.0.0.1', port: headroomPort }, async (request) => {
    if (new URL(request.url).pathname === '/health') return Response.json({ ok: true });
    compressorAuth = request.headers.get('authorization');
    compressorClient = request.headers.get('x-client');
    const body = await request.json();
    assert.deepEqual(body, {
      config: { mode: 'lossy_inline' },
      model: 'gpt-5.6-terra',
      messages: [{ role: 'tool', tool_call_id: 'call_1', content: 'long output' }],
    });
    return Response.json({ messages: [{ role: 'tool', content: 'short' }], tokens_saved: 3 });
  });
  const upstream = Deno.serve({ hostname: '127.0.0.1', port: upstreamPort }, async (request) => {
    upstreamAuth = request.headers.get('authorization');
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
    const response = await fetch(`http://127.0.0.1:${bridgePort}/responses`, {
      method: 'POST',
      headers: { authorization: 'Bearer opaque-oauth-token', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-terra',
        input: [{ type: 'function_call_output', call_id: 'call_1', output: 'long output' }],
      }),
    });
    assert(response.ok);
    assert.equal(compressorAuth, null);
    assert.equal(compressorClient, 'codex');
    assert.equal(upstreamAuth, 'Bearer opaque-oauth-token');
    assert.equal((upstreamBody?.input as Array<Record<string, unknown>>)[0]?.output, 'short');
    assert.deepEqual(await (await fetch(`http://127.0.0.1:${bridgePort}/health`)).json(), {
      ok: true,
      headroom: true,
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
