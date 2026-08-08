import assert from 'node:assert/strict';
import path from 'node:path';
import { ensureCodebaseMemory, ensureWigolo } from './lib/config.ts';
import { gitBlobHash, installBytes } from './lib/files.ts';
import { optionalSkillGroups, optionalSkills, skillsFor } from './skill-manifest.ts';
import { installedSelection, parseArgs } from './selection.ts';
import { pruneManaged, readState, reserve, syncSkills, targetFor, uninstallSkills, writeState } from './sync-skills.ts';

Deno.test('manifest and CLI selection', () => {
  const baseline = skillsFor().map((skill) => `${skill.repository}:${skill.source}`).sort();
  assert.deepEqual(baseline, [
    'DietrichGebert/ponytail:skills',
    'JuliusBrussee/caveman:skills',
    'KnockOutEZ/wigolo:skills',
  ]);

  const all = skillsFor('beeline', optionalSkillGroups.map(({ id }) => id));
  assert.equal(all.length, 37);
  assert(all.find((skill) => skill.repository === 'emilkowalski/skills')?.exclude?.includes('prototype'));
  assert(all.some((skill) => skill.repository === 'denoland/skills' && skill.source === 'skills/deno'));
  assert(
    all.some((skill) =>
      skill.repository === 'tanstack-skills/tanstack-skills' && skill.destination === 'tanstack-query'
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
    optional: ['matt-pocock'],
  });
  assert.deepEqual(parseArgs(['--with', 'deno']).optional, [
    'deno',
    'deno-deploy',
    'deno-frontend',
    'deno-sandbox',
    'migrate-to-deno',
  ]);
  assert.deepEqual(parseArgs(['--with', 'tanstack-query']).optional, ['tanstack-query']);
  assert.deepEqual(parseArgs(['--uninstall', 'tanstack-query']).uninstall, ['tanstack-query']);
  assert.equal(parseArgs(['--refresh', '--yes']).refresh, true);
});

Deno.test('detects destination skills installed locally', () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  try {
    installBytes(targetFor(directory, 'tanstack-query/SKILL.md'), new TextEncoder().encode('skill'));
    assert.deepEqual(installedSelection(directory), ['tanstack-query']);
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});

Deno.test('uses the local cache and uninstalls owned files offline', async () => {
  const directory = Deno.makeTempDirSync({ prefix: 'codex-hook-' });
  try {
    const relative = 'tanstack-query/SKILL.md';
    const target = targetFor(directory, relative);
    const bytes = new TextEncoder().encode('cached skill');
    installBytes(target, bytes);
    writeState(path.join(directory, '.codex-hook', 'skills.json'), {
      version: 2,
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
  } finally {
    Deno.removeSync(directory, { recursive: true });
  }
});
