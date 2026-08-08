import assert from 'node:assert/strict';
import path from 'node:path';
import { ensureCodebaseMemory, ensureWigolo } from './lib/config.ts';
import { installBytes } from './lib/files.ts';
import { optionalSkillGroups, skillsFor } from './skill-manifest.ts';
import { parseArgs } from './selection.ts';
import { pruneManaged, readState, reserve, targetFor, writeState } from './sync-skills.ts';

Deno.test('manifest and CLI selection', () => {
  const baseline = skillsFor().map((skill) => `${skill.repository}:${skill.source}`).sort();
  assert.deepEqual(baseline, [
    'DietrichGebert/ponytail:skills',
    'JuliusBrussee/caveman:skills',
    'KnockOutEZ/wigolo:skills',
  ]);

  const all = skillsFor('beeline', optionalSkillGroups.map(({ id }) => id));
  assert.equal(all.length, 6);
  assert(all.find((skill) => skill.repository === 'emilkowalski/skills')?.exclude?.includes('prototype'));
  assert.deepEqual(parseArgs(['--style', 'baseline', '--with', 'matt-pocock']), {
    interactive: false,
    style: 'caveman',
    optional: ['matt-pocock'],
  });
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
