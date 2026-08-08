#!/usr/bin/env -S deno run -A

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { disablePonytail, ensureCodebaseMemory, ensureWigolo } from './lib/config.ts';
import { copyTree, installFile } from './lib/files.ts';
import { ensureRtk } from './lib/rtk.ts';
import { type InstallSelection, optionalSkillGroups, type Workstyle, workstyles } from './skill-manifest.ts';
import { chooseSelection } from './selection.ts';
import { type ManagedResult, readState, syncSkills } from './sync-skills.ts';

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

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exitCode = 1;
  });
}

async function main() {
  const source = path.resolve(__dirname, '..');
  const codexHome = Deno.env.get('CODEX_HOME') ||
    path.join(os.homedir(), '.codex');
  const selection = await chooseSelection(source, codexHome, Deno.args);
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
    ? workstyles
      .filter(({ id }) => id !== selection.style)
      .flatMap(({ id }) => removeSkillFamily(codexHome, id))
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
