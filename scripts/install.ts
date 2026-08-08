#!/usr/bin/env -S deno run -A

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedStyle } from '../hooks/lib/style.ts';
import { disablePonytail, ensureCodebaseMemory, ensureWigolo } from './lib/config.ts';
import { copyTree, installBytes, installFile } from './lib/files.ts';
import { ensureRtk } from './lib/rtk.ts';
import { type InstallSelection, optionalSkillGroups, skillsFor, type Workstyle } from './skill-manifest.ts';
import {
  type ManagedResult,
  pruneManaged,
  readState,
  reserve,
  syncSkills,
  targetFor,
  writeState,
} from './sync-skills.ts';

type InstallArgs = {
  interactive: boolean;
  style?: Workstyle;
  optional?: string[];
};

type Summary = Record<'replace' | 'skip' | 'remove' | 'preserve', number>;

type PrintedSummary = {
  codexHome: string;
  selection: InstallSelection;
  rtkAction: ReturnType<typeof ensureRtk>;
  skills: Summary;
  files: Summary;
  ponytailChanged: boolean;
  codebaseMemoryChanged: boolean;
  wigoloChanged: boolean;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (Deno.args[0] === '--self-test') {
  selfTest();
  console.log('ok');
  Deno.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  Deno.exitCode = 1;
});

async function main() {
  const source = path.resolve(__dirname, '..');
  const codexHome = Deno.env.get('CODEX_HOME') ||
    path.join(os.homedir(), '.codex');
  const args = parseArgs(Deno.args);
  const saved = savedSelection(codexHome);
  const initial: InstallSelection = {
    style: args.style || saved.style,
    optional: args.optional === undefined ? saved.optional : args.optional,
  };
  const selection = args.interactive && Deno.stdin.isTerminal() && Deno.stdout.isTerminal()
    ? await chooseWithTui(source, initial)
    : initial;
  if (!selection) {
    console.log('Installation cancelled.');
    return;
  }

  const legacyInstall = Object.keys(
    readState(path.join(codexHome, '.codex-hook', 'skills.json')).files,
  ).length === 0;
  const rtkAction = ensureRtk();
  const skillResults = await syncSkills(codexHome, selection);
  const removedSkillResults = legacyInstall
    ? removeSkillFamily(
      codexHome,
      selection.style === 'beeline' ? 'caveman' : 'beeline',
    )
    : [];
  const localSkillResults: ManagedResult[] = [];
  copyTree(
    path.join(source, 'skills'),
    path.join(codexHome, 'skills'),
    (action, target) => {
      localSkillResults.push({ action, target });
    },
  );
  const fileResults: ManagedResult[] = [];
  const report = (action: 'replace' | 'skip', target: string) => fileResults.push({ action, target });
  copyTree(path.join(source, 'hooks'), path.join(codexHome, 'hooks'), report);
  for (const file of ['hooks.json', 'RTK.md']) {
    const target = path.join(codexHome, file);
    report(installFile(path.join(source, file), target), target);
  }
  const configPath = path.join(codexHome, 'config.toml');
  const ponytailChanged = disablePonytail(configPath);
  const codebaseMemoryChanged = ensureCodebaseMemory(configPath);
  const wigoloChanged = ensureWigolo(configPath);
  printSummary({
    codexHome,
    selection,
    rtkAction,
    skills: summarize([
      ...skillResults,
      ...removedSkillResults,
      ...localSkillResults,
    ]),
    files: summarize(fileResults),
    ponytailChanged,
    codebaseMemoryChanged,
    wigoloChanged,
  });
}

async function chooseWithTui(
  source: string,
  defaults: InstallSelection,
): Promise<InstallSelection | null> {
  const output = await Deno.makeTempFile({
    prefix: 'codex-hook-selection-',
    suffix: '.json',
  });
  try {
    let status: { success: boolean; code: number };
    try {
      status = await new Deno.Command('bun', {
        args: [
          'run',
          path.join(source, 'scripts', 'tui.ts'),
          '--output',
          output,
          '--defaults',
          JSON.stringify(defaults),
        ],
        cwd: source,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      }).spawn().status;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(
          'Bun is required for the interactive OpenTUI; use --yes for a Deno-only install',
        );
      }
      throw error;
    }
    if (!status.success) {
      throw new Error(`OpenTUI exited with code ${status.code}`);
    }
    return JSON.parse(await Deno.readTextFile(output)) as
      | InstallSelection
      | null;
  } finally {
    await Deno.remove(output).catch(() => {});
  }
}

function savedSelection(codexHome: string): InstallSelection {
  const state = readState(path.join(codexHome, '.codex-hook', 'skills.json'));
  const style: Workstyle = state.style === 'caveman' || state.style === 'beeline'
    ? state.style
    : installedStyle(codexHome) || 'caveman';
  const known = new Set(optionalSkillGroups.map((group) => group.id));
  const optional = Array.isArray(state.optional) ? state.optional.filter((id) => known.has(id)) : [];
  return { style, optional };
}

function parseArgs(args: string[]): InstallArgs {
  const result: InstallArgs = { interactive: args.length === 0 };
  const known = new Set(optionalSkillGroups.map((group) => group.id));
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--yes') continue;
    if (argument === '--all') {
      result.optional = [...known];
      continue;
    }
    if (argument === '--style' || argument === '--with') {
      if (!args[index + 1]) throw new Error(`${argument} needs a value`);
      if (argument === '--style') result.style = normalizeStyle(args[++index]);
      else result.optional = parseOptional(args[++index], known);
      continue;
    }
    if (argument.startsWith('--style=')) {
      result.style = normalizeStyle(argument.slice(8));
      continue;
    }
    if (argument.startsWith('--with=')) {
      result.optional = parseOptional(argument.slice(7), known);
      continue;
    }
    if (!argument.startsWith('-') && result.style === undefined) {
      result.style = normalizeStyle(argument);
      continue;
    }
    throw new Error(
      `usage: install [caveman|beeline] [--with group,...] [--all] [--yes] (got ${argument})`,
    );
  }
  return result;
}

function normalizeStyle(style: string): Workstyle {
  if (style === 'baseline') return 'caveman';
  if (!['caveman', 'beeline'].includes(style)) {
    throw new Error(`unsupported style: ${style}`);
  }
  return style as Workstyle;
}

function parseOptional(value: string, known: Set<string>) {
  const selected = value ? [...new Set(value.split(',').filter(Boolean))] : [];
  const unknown = selected.filter((id) => !known.has(id));
  if (unknown.length) {
    throw new Error(`unknown optional skill group: ${unknown.join(', ')}`);
  }
  return selected;
}

function removeSkillFamily(
  codexHome: string,
  family: Workstyle,
): ManagedResult[] {
  const root = path.join(codexHome, 'skills');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory() &&
      (entry.name === family || entry.name.startsWith(`${family}-`))
    )
    .map((entry) => {
      const target = path.join(root, entry.name);
      fs.rmSync(target, { recursive: true, force: true });
      return { action: 'remove' as const, target };
    });
}

function summarize(results: readonly Pick<ManagedResult, 'action'>[]): Summary {
  return results.reduce((summary, result) => {
    if (Object.hasOwn(summary, result.action)) summary[result.action]++;
    return summary;
  }, { replace: 0, skip: 0, remove: 0, preserve: 0 } as Summary);
}

function printSummary({
  codexHome,
  selection,
  rtkAction,
  skills,
  files,
  ponytailChanged,
  codebaseMemoryChanged,
  wigoloChanged,
}: PrintedSummary) {
  const optional = selection.optional.length
    ? optionalSkillGroups.filter((group) => selection.optional.includes(group.id)).map((group) => group.label).join(
      ', ',
    )
    : 'none';
  console.log(`
codex-hook install complete
  style    ${selection.style} full
  optional ${optional}
  rtk      ${rtkAction === 'install rtk' ? 'installed' : 'already installed'}
  skills   ${skills.replace} changed, ${skills.skip} unchanged, ${skills.remove} removed, ${skills.preserve} user-modified preserved
  files    ${files.replace} changed, ${files.skip} unchanged
  config   ${ponytailChanged ? 'ponytail hook disabled' : 'ponytail hook already disabled'}
  mcp      codebase-memory ${codebaseMemoryChanged ? 'configured' : 'already configured'}
  mcp      wigolo ${wigoloChanged ? 'configured' : 'already configured'}
  home     ${codexHome}

Next steps
  1. Trust the hook in ${path.join(codexHome, 'hooks')}.
  2. Start a new Codex session.`);
}

function selfTest() {
  const baseline = skillsFor().map((skill) => `${skill.repository}:${skill.source}`).sort().join(',');
  if (
    baseline !==
      'DietrichGebert/ponytail:skills,JuliusBrussee/caveman:skills,KnockOutEZ/wigolo:skills'
  ) {
    throw new Error('baseline skill manifest failed');
  }
  const all = skillsFor(
    'beeline',
    optionalSkillGroups.map((group) => group.id),
  );
  const emil = all.find((skill) => skill.repository === 'emilkowalski/skills');
  if (all.length !== 6 || !emil?.exclude?.includes('prototype')) {
    throw new Error('optional skill manifest failed');
  }
  const parsed = parseArgs(['--style', 'baseline', '--with', 'matt-pocock']);
  if (
    parsed.style !== 'caveman' || parsed.optional?.[0] !== 'matt-pocock' ||
    parsed.interactive
  ) {
    throw new Error('Argument parsing failed');
  }
  expectError(
    () => reserve(new Set(['duplicate']), 'duplicate'),
    'duplicate skill target:',
  );
  expectError(
    () => targetFor('/tmp/codex-hook-test', '../escape'),
    'invalid skill target:',
  );

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-hook-'));
  try {
    const managedRelative = 'optional/SKILL.md';
    const managedTarget = targetFor(directory, managedRelative);
    installBytes(managedTarget, new TextEncoder().encode('user edit'));
    const preserved = pruneManaged(directory, {
      [managedRelative]: 'upstream hash',
    }, {});
    if (preserved[0]?.action !== 'preserve') {
      throw new Error('Modified skill preservation failed');
    }
    const statePath = path.join(directory, '.codex-hook', 'skills.json');
    writeState(statePath, {
      version: 1,
      style: 'caveman',
      optional: [],
      files: {},
    });
    if (readState(statePath).style !== 'caveman') {
      throw new Error('Managed state failed');
    }

    const configPath = path.join(directory, 'config.toml');
    if (
      !ensureCodebaseMemory(configPath) || ensureCodebaseMemory(configPath) ||
      !ensureWigolo(configPath) || ensureWigolo(configPath)
    ) {
      throw new Error('Core MCP config failed');
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function expectError(run: () => void, prefix: string) {
  try {
    run();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(prefix)) return;
    throw error;
  }
  throw new Error(`expected error: ${prefix}`);
}
